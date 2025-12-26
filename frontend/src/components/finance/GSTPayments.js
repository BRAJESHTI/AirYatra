import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  CreditCard, 
  Plus,
  CheckCircle,
  RefreshCw,
  IndianRupee,
  Building,
  Receipt
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const GSTPayments = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [newPayment, setNewPayment] = useState({
    return_type: 'GSTR-3B',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    cgst_paid: 0,
    sgst_paid: 0,
    igst_paid: 0,
    cess_paid: 0,
    interest_paid: 0,
    late_fee_paid: 0,
    payment_mode: 'netbanking',
    bank_name: '',
    bank_reference: '',
    challan_number: ''
  });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/gst/payments');
      setPayments(response.data.payments || []);
      setSummary(response.data.summary || {});
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const recordPayment = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/gst/payments/record', newPayment);
      toast.success(`Payment recorded! Challan: ${response.data.challan_number}`);
      setShowPaymentDialog(false);
      setNewPayment({
        return_type: 'GSTR-3B',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        cgst_paid: 0,
        sgst_paid: 0,
        igst_paid: 0,
        cess_paid: 0,
        interest_paid: 0,
        late_fee_paid: 0,
        payment_mode: 'netbanking',
        bank_name: '',
        bank_reference: '',
        challan_number: ''
      });
      fetchPayments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    }
    setProcessing(false);
  };

  const totalPaid = (newPayment.cgst_paid || 0) + (newPayment.sgst_paid || 0) + 
                    (newPayment.igst_paid || 0) + (newPayment.cess_paid || 0) + 
                    (newPayment.interest_paid || 0) + (newPayment.late_fee_paid || 0);

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
          <h3 className="text-xl font-bold text-white">GST Payments / GST भुगतान</h3>
          <p className="text-slate-400">Record and track GST payments</p>
        </div>
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-white">Record GST Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Return Type</label>
                  <Select value={newPayment.return_type} onValueChange={(v) => setNewPayment({...newPayment, return_type: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="GSTR-3B" className="text-white">GSTR-3B</SelectItem>
                      <SelectItem value="GSTR-1" className="text-white">GSTR-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Month</label>
                  <Select value={String(newPayment.month)} onValueChange={(v) => setNewPayment({...newPayment, month: Number(v)})}>
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
                  <Select value={String(newPayment.year)} onValueChange={(v) => setNewPayment({...newPayment, year: Number(v)})}>
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
              
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-medium mb-3">Tax Breakup</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">CGST (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.cgst_paid}
                      onChange={(e) => setNewPayment({...newPayment, cgst_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">SGST (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.sgst_paid}
                      onChange={(e) => setNewPayment({...newPayment, sgst_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">IGST (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.igst_paid}
                      onChange={(e) => setNewPayment({...newPayment, igst_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Cess (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.cess_paid}
                      onChange={(e) => setNewPayment({...newPayment, cess_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Interest (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.interest_paid}
                      onChange={(e) => setNewPayment({...newPayment, interest_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Late Fee (₹)</label>
                    <Input 
                      type="number"
                      value={newPayment.late_fee_paid}
                      onChange={(e) => setNewPayment({...newPayment, late_fee_paid: Number(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-500/20 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Payment:</span>
                  <span className="text-emerald-400 font-bold text-xl">₹{totalPaid.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-medium mb-3">Payment Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Payment Mode</label>
                    <Select value={newPayment.payment_mode} onValueChange={(v) => setNewPayment({...newPayment, payment_mode: v})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="netbanking" className="text-white">Net Banking</SelectItem>
                        <SelectItem value="neft" className="text-white">NEFT</SelectItem>
                        <SelectItem value="rtgs" className="text-white">RTGS</SelectItem>
                        <SelectItem value="cash" className="text-white">Over Counter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Challan Number</label>
                    <Input 
                      value={newPayment.challan_number}
                      onChange={(e) => setNewPayment({...newPayment, challan_number: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="From GST portal"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Bank Name</label>
                    <Input 
                      value={newPayment.bank_name}
                      onChange={(e) => setNewPayment({...newPayment, bank_name: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Bank Reference</label>
                    <Input 
                      value={newPayment.bank_reference}
                      onChange={(e) => setNewPayment({...newPayment, bank_reference: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={recordPayment} disabled={processing || totalPaid <= 0} className="bg-emerald-600">
                {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-emerald-500/20 border-emerald-500/30">
          <CardContent className="pt-6">
            <IndianRupee className="h-6 w-6 text-emerald-400 mb-2" />
            <p className="text-2xl font-bold text-white">₹{(summary.total_paid || 0).toLocaleString()}</p>
            <p className="text-slate-400 text-sm">Total Paid</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/20 border-blue-500/30">
          <CardContent className="pt-6">
            <Receipt className="h-6 w-6 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">₹{(summary.total_cgst || 0).toLocaleString()}</p>
            <p className="text-slate-400 text-sm">CGST Paid</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/20 border-purple-500/30">
          <CardContent className="pt-6">
            <Receipt className="h-6 w-6 text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">₹{(summary.total_sgst || 0).toLocaleString()}</p>
            <p className="text-slate-400 text-sm">SGST Paid</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/20 border-orange-500/30">
          <CardContent className="pt-6">
            <Receipt className="h-6 w-6 text-orange-400 mb-2" />
            <p className="text-2xl font-bold text-white">₹{(summary.total_igst || 0).toLocaleString()}</p>
            <p className="text-slate-400 text-sm">IGST Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Challan No.</TableHead>
                <TableHead className="text-slate-400">Period</TableHead>
                <TableHead className="text-slate-400">Return</TableHead>
                <TableHead className="text-slate-400">CGST</TableHead>
                <TableHead className="text-slate-400">SGST</TableHead>
                <TableHead className="text-slate-400">IGST</TableHead>
                <TableHead className="text-slate-400">Total</TableHead>
                <TableHead className="text-slate-400">Mode</TableHead>
                <TableHead className="text-slate-400">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(payment => (
                <TableRow key={payment.id} className="border-slate-700">
                  <TableCell className="text-white font-mono">{payment.challan_number}</TableCell>
                  <TableCell className="text-slate-300">{payment.period}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {payment.return_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-blue-400">₹{payment.cgst_paid?.toLocaleString()}</TableCell>
                  <TableCell className="text-purple-400">₹{payment.sgst_paid?.toLocaleString()}</TableCell>
                  <TableCell className="text-orange-400">₹{payment.igst_paid?.toLocaleString()}</TableCell>
                  <TableCell className="text-emerald-400 font-semibold">₹{payment.total_paid?.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-300 capitalize">{payment.payment_mode}</TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-400 py-8">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GSTPayments;