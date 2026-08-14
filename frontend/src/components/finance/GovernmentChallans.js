import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Calendar, AlertTriangle, CheckCircle, Clock, XCircle,
  RefreshCw, Search, Filter, DollarSign, Building2, Receipt, CreditCard,
  TrendingUp, Bell, AlertCircle, ChevronRight, Eye
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

const challanTypes = [
  { value: 'GST', label: 'GST (Goods & Services Tax)', color: 'bg-blue-500' },
  { value: 'TDS', label: 'TDS (Tax Deducted at Source)', color: 'bg-purple-500' },
  { value: 'PF', label: 'PF (Provident Fund)', color: 'bg-green-500' },
  { value: 'ESIC', label: 'ESIC (Employee State Insurance)', color: 'bg-orange-500' },
  { value: 'PT', label: 'PT (Professional Tax)', color: 'bg-yellow-500' },
  { value: 'IT', label: 'IT (Income Tax Advance)', color: 'bg-red-500' }
];

export default function GovernmentChallans() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [summary, setSummary] = useState({});
  const [upcoming, setUpcoming] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  
  const [newChallan, setNewChallan] = useState({
    challan_type: 'GST',
    period: '',
    due_date: '',
    amount: '',
    description: '',
    reference_number: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [challansRes, upcomingRes] = await Promise.all([
        api.get('/finance/advanced/challans'),
        api.get('/finance/advanced/challans/upcoming')
      ]);
      setChallans(challansRes.data.challans || []);
      setSummary(challansRes.data.summary || {});
      setUpcoming(upcomingRes.data.upcoming || []);
    } catch (error) {
      console.error('Error fetching challans:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateChallan = async () => {
    try {
      await api.post('/finance/advanced/challans', {
        ...newChallan,
        amount: parseFloat(newChallan.amount)
      });
      toast.success('Challan created successfully');
      setShowAddModal(false);
      setNewChallan({
        challan_type: 'GST',
        period: '',
        due_date: '',
        amount: '',
        description: '',
        reference_number: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create challan');
    }
  };

  const handleMarkPaid = async (challanId) => {
    try {
      await api.put(`/finance/advanced/challans/${challanId}/pay`);
      toast.success('Challan marked as paid');
      fetchData();
    } catch (error) {
      toast.error('Failed to update challan');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      overdue: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
      cancelled: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.bg} ${c.text} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status?.toUpperCase()}
      </Badge>
    );
  };

  const filteredChallans = challans.filter(c => {
    if (selectedType !== 'all' && c.challan_type !== selectedType) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="government-challans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-400" />
            Government Challans</h1>
          <p className="text-slate-400 mt-1">GST, TDS, PF, ESIC compliance management</p>
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Challan
          </Button>
        </div>
      </div>

      {/* Urgent Alerts */}
      {upcoming.filter(u => u.days_remaining <= 7).length > 0 && (
        <div className="space-y-2">
          {upcoming.filter(u => u.days_remaining <= 7).slice(0, 3).map((item, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-lg flex items-center justify-between ${
                item.urgency === 'critical' 
                  ? 'bg-red-500/20 border border-red-500/50' 
                  : 'bg-yellow-500/20 border border-yellow-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${item.urgency === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                <span className="text-white">
                  <strong>{item.challan_type}</strong> for {item.period} due in <strong>{item.days_remaining} days</strong>
                </span>
              </div>
              <span className="text-white font-semibold">{formatINR(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-6 gap-3">
        {challanTypes.map(type => {
          const data = summary[type.value] || {};
          return (
            <Card 
              key={type.value}
              className={`bg-slate-800/50 border-slate-700 cursor-pointer hover:border-slate-500 transition-colors ${
                selectedType === type.value ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedType(selectedType === type.value ? 'all' : type.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${type.color}`} />
                  <span className="text-white font-medium text-sm">{type.value}</span>
                </div>
                <p className="text-2xl font-bold text-white">{data.pending_count || 0}</p>
                <p className="text-xs text-slate-400">Pending</p>
                {data.overdue_count > 0 && (
                  <p className="text-xs text-red-400 mt-1">⚠ {data.overdue_count} overdue</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Status</SelectItem>
            <SelectItem value="pending" className="text-white">Pending</SelectItem>
            <SelectItem value="overdue" className="text-white">Overdue</SelectItem>
            <SelectItem value="paid" className="text-white">Paid</SelectItem>
          </SelectContent>
        </Select>
        {selectedType !== 'all' && (
          <Badge 
            className="bg-blue-500/20 text-blue-400 cursor-pointer"
            onClick={() => setSelectedType('all')}
          >
            {selectedType} × Clear
          </Badge>
        )}
      </div>

      {/* Challans Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-400" />
            Challans List ({filteredChallans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredChallans.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No challans found</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowAddModal(true)}
              >
                Create First Challan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChallans.map(challan => {
                const typeConfig = challanTypes.find(t => t.value === challan.challan_type);
                return (
                  <div 
                    key={challan.id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${typeConfig?.color || 'bg-slate-700'}`}>
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{challan.challan_type}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300">{challan.period}</span>
                          {getStatusBadge(challan.status)}
                        </div>
                        <p className="text-sm text-slate-400">{challan.challan_number}</p>
                        <p className="text-xs text-slate-500">
                          Due: {new Date(challan.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">{formatINR(challan.amount)}</p>
                      </div>
                      {challan.status === 'pending' || challan.status === 'overdue' ? (
                        <Button 
                          size="sm"
                          onClick={() => handleMarkPaid(challan.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Challan Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />
              Add New Challan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Challan Type *</label>
              <Select 
                value={newChallan.challan_type} 
                onValueChange={(v) => setNewChallan({...newChallan, challan_type: v})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {challanTypes.map(type => (
                    <SelectItem key={type.value} value={type.value} className="text-white">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Period *</label>
                <Input 
                  value={newChallan.period}
                  onChange={(e) => setNewChallan({...newChallan, period: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Jul-2026, Q1-2026"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Due Date *</label>
                <Input 
                  type="date"
                  value={newChallan.due_date}
                  onChange={(e) => setNewChallan({...newChallan, due_date: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Amount (₹) *</label>
              <Input 
                type="number"
                value={newChallan.amount}
                onChange={(e) => setNewChallan({...newChallan, amount: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <Input 
                value={newChallan.description}
                onChange={(e) => setNewChallan({...newChallan, description: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateChallan}
              disabled={!newChallan.period || !newChallan.due_date || !newChallan.amount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Challan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
