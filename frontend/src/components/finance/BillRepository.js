import React, { useState, useEffect, useCallback } from 'react';
import { 
  Archive, Search, Plus, RefreshCw, FileText, Tag, Calendar,
  Filter, Eye, Trash2, Download, Building2, DollarSign, X,
  ChevronRight, BarChart3, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const billCategories = [
  'fuel', 'maintenance', 'insurance', 'rental', 'services',
  'equipment', 'utilities', 'travel', 'legal', 'marketing', 'other'
];

export default function BillRepository() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ categories: [], tags: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [newBill, setNewBill] = useState({
    vendor_id: '',
    vendor_name: '',
    invoice_number: '',
    invoice_date: '',
    amount: '',
    category: 'services',
    description: '',
    gst_number: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedTag !== 'all') params.append('tag', selectedTag);
      
      const [billsRes, statsRes] = await Promise.all([
        api.get(`/finance/phase4/bills?${params.toString()}`),
        api.get('/finance/phase4/bills/stats')
      ]);
      setBills(billsRes.data.bills || []);
      setFilters(billsRes.data.filters || { categories: [], tags: [] });
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedCategory, selectedTag]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchData]);

  const handleCreateBill = async () => {
    try {
      await api.post('/finance/phase4/bills', {
        ...newBill,
        amount: parseFloat(newBill.amount)
      });
      toast.success('Bill added to repository');
      setShowAddModal(false);
      setNewBill({
        vendor_id: '',
        vendor_name: '',
        invoice_number: '',
        invoice_date: '',
        amount: '',
        category: 'services',
        description: '',
        gst_number: '',
        tags: []
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to add bill');
    }
  };

  const handleArchiveBill = async (billId) => {
    try {
      await api.put(`/finance/phase4/bills/${billId}/archive`);
      toast.success('Bill archived');
      fetchData();
    } catch (error) {
      toast.error('Failed to archive bill');
    }
  };

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowViewModal(true);
  };

  const addTag = () => {
    if (tagInput && !newBill.tags.includes(tagInput)) {
      setNewBill({ ...newBill, tags: [...newBill.tags, tagInput] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setNewBill({ ...newBill, tags: newBill.tags.filter(t => t !== tag) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bill-repository">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Archive className="h-7 w-7 text-indigo-400" />
            Bill Repository / बिल भंडार
          </h1>
          <p className="text-slate-400 mt-1">Searchable archive of all vendor invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
            className="border-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Bill
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-600/30 to-indigo-800/30 border-indigo-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm">Total Bills</p>
                <p className="text-3xl font-bold text-white mt-1">{stats?.total_bills || 0}</p>
              </div>
              <FileText className="h-10 w-10 text-indigo-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-purple-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Total Amount</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(stats?.total_amount)}</p>
              </div>
              <DollarSign className="h-10 w-10 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avg. Bill Amount</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(stats?.average_bill_amount)}</p>
              </div>
              <BarChart3 className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Categories</p>
                <p className="text-3xl font-bold text-white mt-1">{Object.keys(stats?.by_category || {}).length}</p>
              </div>
              <Tag className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vendor, invoice number, description..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Categories</SelectItem>
            {filters.categories.map(cat => (
              <SelectItem key={cat} value={cat} className="text-white capitalize">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <Tag className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Tags</SelectItem>
            {filters.tags.map(tag => (
              <SelectItem key={tag} value={tag} className="text-white">{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bills List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Bills ({bills.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No bills found</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowAddModal(true)}
              >
                Add First Bill
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map(bill => (
                <div 
                  key={bill.id || bill._id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleViewBill(bill)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <FileText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{bill.vendor_name}</h4>
                        <Badge className="bg-slate-700 text-slate-300 border-0 text-xs capitalize">
                          {bill.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">
                        {bill.bill_number} • Invoice: {bill.invoice_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(bill.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {bill.tags?.length > 0 && (
                      <div className="flex gap-1">
                        {bill.tags.slice(0, 2).map((tag, idx) => (
                          <Badge key={idx} className="bg-indigo-500/20 text-indigo-400 border-0 text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {bill.tags.length > 2 && (
                          <Badge className="bg-slate-700 text-slate-400 border-0 text-xs">
                            +{bill.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{formatINR(bill.amount)}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bill Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              Add Bill / बिल जोड़ें
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Vendor Name *</label>
                <Input 
                  value={newBill.vendor_name}
                  onChange={(e) => setNewBill({...newBill, vendor_name: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Indian Oil Corporation"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Invoice Number *</label>
                <Input 
                  value={newBill.invoice_number}
                  onChange={(e) => setNewBill({...newBill, invoice_number: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Invoice Date *</label>
                <Input 
                  type="date"
                  value={newBill.invoice_date}
                  onChange={(e) => setNewBill({...newBill, invoice_date: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Amount (₹) *</label>
                <Input 
                  type="number"
                  value={newBill.amount}
                  onChange={(e) => setNewBill({...newBill, amount: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Category *</label>
                <Select 
                  value={newBill.category} 
                  onValueChange={(v) => setNewBill({...newBill, category: v})}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {billCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-white capitalize">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <Input 
                  value={newBill.description}
                  onChange={(e) => setNewBill({...newBill, description: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Optional description"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">GST Number</label>
                <Input 
                  value={newBill.gst_number}
                  onChange={(e) => setNewBill({...newBill, gst_number: e.target.value.toUpperCase()})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., 27AABCU9603R1ZM"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Tags</label>
                <div className="flex gap-2">
                  <Input 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Add tag..."
                  />
                  <Button onClick={addTag} variant="outline" className="border-slate-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newBill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newBill.tags.map((tag, idx) => (
                      <Badge 
                        key={idx}
                        className="bg-indigo-500/20 text-indigo-400 cursor-pointer hover:bg-red-500/20"
                        onClick={() => removeTag(tag)}
                      >
                        {tag} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBill}
              disabled={!newBill.vendor_name || !newBill.invoice_number || !newBill.amount}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Bill Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-400" />
              Bill Details / बिल विवरण
            </DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Bill Number</p>
                  <p className="text-white font-medium">{selectedBill.bill_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Invoice Number</p>
                  <p className="text-white font-medium">{selectedBill.invoice_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Vendor</p>
                  <p className="text-white font-medium">{selectedBill.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="text-white font-medium">
                    {new Date(selectedBill.invoice_date).toLocaleDateString('en-IN', { 
                      day: '2-digit', month: 'long', year: 'numeric' 
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Amount</p>
                  <p className="text-2xl font-bold text-white">{formatINR(selectedBill.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Category</p>
                  <Badge className="bg-slate-700 text-slate-300 capitalize">{selectedBill.category}</Badge>
                </div>
                {selectedBill.gst_number && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">GST Number</p>
                    <p className="text-white font-mono">{selectedBill.gst_number}</p>
                  </div>
                )}
                {selectedBill.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Description</p>
                    <p className="text-slate-300">{selectedBill.description}</p>
                  </div>
                )}
                {selectedBill.tags?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBill.tags.map((tag, idx) => (
                        <Badge key={idx} className="bg-indigo-500/20 text-indigo-400">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              className="border-red-500/50 text-red-400 hover:bg-red-500/20"
              onClick={() => {
                handleArchiveBill(selectedBill?.id || selectedBill?._id);
                setShowViewModal(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Archive
            </Button>
            <Button variant="outline" onClick={() => setShowViewModal(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
