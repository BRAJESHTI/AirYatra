import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Calendar,
  Upload,
  Download
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const GSTReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  const [newReturn, setNewReturn] = useState({
    return_type: 'GSTR-3B',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  
  const [arnNumber, setArnNumber] = useState('');

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/gst/returns');
      setReturns(response.data.returns || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const createReturn = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/gst/returns/create', newReturn);
      toast.success(`${newReturn.return_type} created! Tax Payable: ₹${response.data.summary?.total_tax_payable?.toLocaleString() || 0}`);
      setShowCreateDialog(false);
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create return');
    }
    setProcessing(false);
  };

  const fileReturn = async () => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      const response = await api.post(`/gst/returns/${selectedReturn.id}/file`, {
        arn: arnNumber
      });
      toast.success(`Return filed! ARN: ${response.data.arn}`);
      setShowFileDialog(false);
      setSelectedReturn(null);
      setArnNumber('');
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to file return');
    }
    setProcessing(false);
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-500', icon: Clock },
      draft: { color: 'bg-blue-500', icon: FileText },
      filed: { color: 'bg-green-500', icon: CheckCircle },
      accepted: { color: 'bg-emerald-500', icon: CheckCircle },
      rejected: { color: 'bg-red-500', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {status?.toUpperCase()}
      </Badge>
    );
  };

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">GST Returns / GST</h3>
          <p className="text-slate-400">GSTR-1, GSTR-3B Filing</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Return
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create GST Return</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-slate-400">Return Type</label>
                <Select value={newReturn.return_type} onValueChange={(v) => setNewReturn({...newReturn, return_type: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="GSTR-1" className="text-white">GSTR-1 (Outward Supplies)</SelectItem>
                    <SelectItem value="GSTR-3B" className="text-white">GSTR-3B (Monthly Summary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Month</label>
                  <Select value={String(newReturn.month)} onValueChange={(v) => setNewReturn({...newReturn, month: Number(v)})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {months.map(m => (
                        <SelectItem key={m.value} value={String(m.value)} className="text-white">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Year</label>
                  <Select value={String(newReturn.year)} onValueChange={(v) => setNewReturn({...newReturn, year: Number(v)})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {[2024, 2025, 2026].map(y => (
                        <SelectItem key={y} value={String(y)} className="text-white">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <AlertDescription className="text-blue-400 text-sm">
                  GST data will be auto-calculated from invoices and vendor bills.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={createReturn} disabled={processing} className="bg-emerald-600">
                {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Returns Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Return No.</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Period</TableHead>
                <TableHead className="text-slate-400">Tax Payable</TableHead>
                <TableHead className="text-slate-400">Due Date</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">ARN</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map(ret => (
                <TableRow key={ret.id} className="border-slate-700">
                  <TableCell className="text-white font-mono">{ret.return_number}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {ret.return_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">{ret.period}</TableCell>
                  <TableCell className="text-yellow-400 font-semibold">
                    ₹{ret.total_tax_payable?.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1 text-slate-500" />
                      {ret.due_date}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(ret.status)}</TableCell>
                  <TableCell className="text-emerald-400 font-mono text-sm">
                    {ret.arn || '-'}
                  </TableCell>
                  <TableCell>
                    {ret.status === 'draft' && (
                      <Button 
                        size="sm" 
                        className="bg-green-600"
                        onClick={() => {
                          setSelectedReturn(ret);
                          setShowFileDialog(true);
                        }}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        File
                      </Button>
                    )}
                    {ret.status === 'filed' && (
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                    No GST returns found. Create your first return.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* File Return Dialog */}
      <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">File GST Return</DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-white font-medium">{selectedReturn.return_type} - {selectedReturn.period}</p>
                <p className="text-yellow-400 text-lg font-bold">Tax Payable: ₹{selectedReturn.total_tax_payable?.toLocaleString()}</p>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">ARN (Acknowledgment Reference Number)</label>
                <Input 
                  value={arnNumber}
                  onChange={(e) => setArnNumber(e.target.value.toUpperCase())}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter ARN from GST portal"
                />
              </div>
              
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertDescription className="text-yellow-400 text-sm">
                  Please file this return on the GST portal first, then enter the ARN here.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={fileReturn} disabled={processing || !arnNumber} className="bg-green-600">
              {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Mark as Filed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GSTReturns;