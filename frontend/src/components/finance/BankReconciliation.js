import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Upload, Search, CheckCircle, XCircle, AlertCircle, Clock,
  FileText, Building2, ArrowRight, Filter, Link2, LinkIcon, Eye, Zap,
  TrendingUp, TrendingDown, BarChart3, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function BankReconciliation() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Upload form state
  const [uploadEntries, setUploadEntries] = useState([
    { transaction_date: '', description: '', reference: '', debit: '', credit: '', balance: '' }
  ]);
  const [uploadBankId, setUploadBankId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [entriesRes, summaryRes, banksRes] = await Promise.all([
        api.get(`/finance/advanced/reconciliation/entries${selectedBank !== 'all' ? `?bank_account_id=${selectedBank}` : ''}`),
        api.get(`/finance/advanced/reconciliation/summary${selectedBank !== 'all' ? `?bank_account_id=${selectedBank}` : ''}`),
        api.get('/finance/bank-accounts')
      ]);
      setEntries(entriesRes.data.entries || []);
      setSummary(summaryRes.data);
      setBankAccounts(banksRes.data.accounts || []);
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBank]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAutoMatch = async () => {
    if (selectedBank === 'all') {
      toast.error('Select a bank account first');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await api.post(`/finance/advanced/reconciliation/auto-match?bank_account_id=${selectedBank}`);
      toast.success(`Auto-matched ${response.data.matched_count} entries`);
      fetchData();
    } catch (error) {
      toast.error('Auto-match failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualMatch = async (entryId, transactionId) => {
    try {
      await api.put(`/finance/advanced/reconciliation/entries/${entryId}/match?transaction_id=${transactionId}`);
      toast.success('Entry matched successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to match entry');
    }
  };

  const handleIgnoreEntry = async (entryId) => {
    try {
      await api.put(`/finance/advanced/reconciliation/entries/${entryId}/ignore`);
      toast.success('Entry ignored');
      fetchData();
    } catch (error) {
      toast.error('Failed to ignore entry');
    }
  };

  const handleUploadStatement = async () => {
    if (!uploadBankId) {
      toast.error('Select a bank account');
      return;
    }
    
    const validEntries = uploadEntries
      .filter(e => e.transaction_date && e.description && (e.debit || e.credit))
      .map(e => ({
        ...e,
        bank_account_id: uploadBankId,
        debit: parseFloat(e.debit) || 0,
        credit: parseFloat(e.credit) || 0,
        balance: parseFloat(e.balance) || 0
      }));
    
    if (validEntries.length === 0) {
      toast.error('Add at least one valid entry');
      return;
    }
    
    setProcessing(true);
    try {
      await api.post('/finance/advanced/reconciliation/upload-statement', validEntries);
      toast.success(`Uploaded ${validEntries.length} entries`);
      setShowUploadModal(false);
      setUploadEntries([{ transaction_date: '', description: '', reference: '', debit: '', credit: '', balance: '' }]);
      fetchData();
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const addUploadRow = () => {
    setUploadEntries([...uploadEntries, { transaction_date: '', description: '', reference: '', debit: '', credit: '', balance: '' }]);
  };

  const updateUploadRow = (index, field, value) => {
    const newEntries = [...uploadEntries];
    newEntries[index][field] = value;
    setUploadEntries(newEntries);
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      matched: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      unmatched: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
      ignored: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: AlertCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.bg} ${c.text} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const filteredEntries = entries.filter(e => {
    if (selectedStatus !== 'all' && e.reconciliation_status !== selectedStatus) return false;
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
    <div className="space-y-6" data-testid="bank-reconciliation">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="h-7 w-7 text-purple-400" />
            Bank Reconciliation / बैंक मिलान
          </h1>
          <p className="text-slate-400 mt-1">Match bank statements with recorded transactions</p>
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
            variant="outline"
            onClick={handleAutoMatch}
            disabled={processing || selectedBank === 'all'}
            className="border-purple-500 text-purple-400"
          >
            <Zap className="h-4 w-4 mr-2" />
            Auto Match
          </Button>
          <Button 
            onClick={() => setShowUploadModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Statement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-purple-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Reconciliation Rate</p>
                <p className="text-3xl font-bold text-white mt-1">{summary?.reconciliation_rate || 0}%</p>
              </div>
              <Target className="h-10 w-10 text-purple-400 opacity-80" />
            </div>
            <Progress value={summary?.reconciliation_rate || 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Entries</p>
                <p className="text-3xl font-bold text-white mt-1">{summary?.total_entries || 0}</p>
              </div>
              <FileText className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm">Matched</p>
                <p className="text-3xl font-bold text-white mt-1">{summary?.matched_entries || 0}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 text-sm">Unmatched</p>
                <p className="text-3xl font-bold text-white mt-1">{summary?.unmatched_entries || 0}</p>
              </div>
              <XCircle className="h-10 w-10 text-red-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Comparison */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            Balance Comparison / बैलेंस तुलना
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-slate-400 text-sm font-medium">Bank Statement</h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Credits</span>
                  <span className="text-green-400 font-semibold">{formatINR(summary?.bank_balance?.total_credits)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-400">Debits</span>
                  <span className="text-red-400 font-semibold">{formatINR(summary?.bank_balance?.total_debits)}</span>
                </div>
                <hr className="border-slate-700 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Net</span>
                  <span className="text-white font-bold">{formatINR(summary?.bank_balance?.net)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-slate-400 text-sm font-medium">Reconciled</h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Credits</span>
                  <span className="text-green-400 font-semibold">{formatINR(summary?.reconciled_amount?.credits)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-400">Debits</span>
                  <span className="text-red-400 font-semibold">{formatINR(summary?.reconciled_amount?.debits)}</span>
                </div>
                <hr className="border-slate-700 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Net</span>
                  <span className="text-green-400 font-bold">{formatINR(summary?.reconciled_amount?.net)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-slate-400 text-sm font-medium">Unreconciled</h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Credits</span>
                  <span className="text-yellow-400 font-semibold">{formatINR(summary?.unreconciled_amount?.credits)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-400">Debits</span>
                  <span className="text-yellow-400 font-semibold">{formatINR(summary?.unreconciled_amount?.debits)}</span>
                </div>
                <hr className="border-slate-700 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Difference</span>
                  <span className={`font-bold ${(summary?.unreconciled_amount?.credits - summary?.unreconciled_amount?.debits) === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatINR(summary?.unreconciled_amount?.credits - summary?.unreconciled_amount?.debits)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedBank} onValueChange={setSelectedBank}>
          <SelectTrigger className="w-60 bg-slate-800 border-slate-700 text-white">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select Bank" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Banks</SelectItem>
            {bankAccounts.map(bank => (
              <SelectItem key={bank.id || bank._id} value={bank.id || bank._id} className="text-white">
                {bank.bank_name} - {bank.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Status</SelectItem>
            <SelectItem value="pending" className="text-white">Pending</SelectItem>
            <SelectItem value="matched" className="text-white">Matched</SelectItem>
            <SelectItem value="unmatched" className="text-white">Unmatched</SelectItem>
            <SelectItem value="ignored" className="text-white">Ignored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entries List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            Statement Entries ({filteredEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No entries found</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowUploadModal(true)}
              >
                Upload Bank Statement
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.slice(0, 20).map(entry => (
                <div 
                  key={entry.id || entry._id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${entry.credit > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {entry.credit > 0 ? 
                        <TrendingDown className="h-4 w-4 text-green-400" /> :
                        <TrendingUp className="h-4 w-4 text-red-400" />
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{entry.description}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(entry.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {entry.reference && ` • Ref: ${entry.reference}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {entry.credit > 0 ? (
                        <p className="text-green-400 font-semibold">+{formatINR(entry.credit)}</p>
                      ) : (
                        <p className="text-red-400 font-semibold">-{formatINR(entry.debit)}</p>
                      )}
                    </div>
                    {getStatusBadge(entry.reconciliation_status)}
                    {entry.reconciliation_status === 'unmatched' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleIgnoreEntry(entry.id || entry._id)}
                        className="border-slate-600"
                      >
                        Ignore
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Statement Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-400" />
              Upload Bank Statement / बैंक स्टेटमेंट अपलोड करें
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank Account *</label>
              <Select value={uploadBankId} onValueChange={setUploadBankId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {bankAccounts.map(bank => (
                    <SelectItem key={bank.id || bank._id} value={bank.id || bank._id} className="text-white">
                      {bank.bank_name} - {bank.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="grid grid-cols-6 gap-2 p-3 bg-slate-800 text-sm text-slate-400 font-medium">
                <span>Date</span>
                <span className="col-span-2">Description</span>
                <span>Debit (₹)</span>
                <span>Credit (₹)</span>
                <span>Balance (₹)</span>
              </div>
              {uploadEntries.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 p-2 border-t border-slate-700">
                  <Input 
                    type="date"
                    value={entry.transaction_date}
                    onChange={(e) => updateUploadRow(idx, 'transaction_date', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                  <Input 
                    value={entry.description}
                    onChange={(e) => updateUploadRow(idx, 'description', e.target.value)}
                    className="col-span-2 bg-slate-800 border-slate-700 text-white text-sm"
                    placeholder="Description"
                  />
                  <Input 
                    type="number"
                    value={entry.debit}
                    onChange={(e) => updateUploadRow(idx, 'debit', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                    placeholder="0"
                  />
                  <Input 
                    type="number"
                    value={entry.credit}
                    onChange={(e) => updateUploadRow(idx, 'credit', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                    placeholder="0"
                  />
                  <Input 
                    type="number"
                    value={entry.balance}
                    onChange={(e) => updateUploadRow(idx, 'balance', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
              <Button 
                variant="ghost" 
                className="w-full text-purple-400 hover:text-purple-300"
                onClick={addUploadRow}
              >
                + Add Row
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleUploadStatement}
              disabled={processing || !uploadBankId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {processing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
