import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2,
  FileText,
  Calculator,
  Send,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Percent,
  IndianRupee,
  Search,
  Filter
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const VendorBillPayment = () => {
  const [vendors, setVendors] = useState([]);
  const [bills, setBills] = useState([]);
  const [tdsSections, setTdsSections] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedBills, setSelectedBills] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState('razorpayx');
  const [selectedMode, setSelectedMode] = useState('NEFT');
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showTDSCalculator, setShowTDSCalculator] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [newVendor, setNewVendor] = useState({
    name: '', type: 'individual', pan_number: '', gst_number: '',
    email: '', phone: '', address: '', bank_name: '',
    account_number: '', ifsc_code: '', account_holder_name: '',
    tds_section: 'none', tds_rate: 0
  });
  
  const [newBill, setNewBill] = useState({
    vendor_id: '', amount: 0, invoice_number: '',
    invoice_date: '', due_date: '', description: '', category: 'general'
  });
  
  const [tdsCalc, setTdsCalc] = useState({
    vendor_type: 'individual', tds_section: '194C', amount: 0, has_pan: true
  });
  const [tdsResult, setTdsResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendorsRes, billsRes, sectionsRes, gatewaysRes] = await Promise.all([
        api.get('/payments/vendor/list'),
        api.get('/payments/vendor/bills'),
        api.get('/payments/tds/sections'),
        api.get('/payments/gateways/available')
      ]);
      setVendors(vendorsRes.data.vendors || []);
      setBills(billsRes.data.bills || []);
      setTdsSections(sectionsRes.data.sections || []);
      setGateways(gatewaysRes.data.gateways || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const createVendor = async () => {
    setProcessing(true);
    try {
      await api.post('/payments/vendor/create', newVendor);
      toast.success('Vendor created successfully!');
      setShowVendorDialog(false);
      setNewVendor({
        name: '', type: 'individual', pan_number: '', gst_number: '',
        email: '', phone: '', address: '', bank_name: '',
        account_number: '', ifsc_code: '', account_holder_name: '',
        tds_section: 'none', tds_rate: 0
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create vendor');
    }
    setProcessing(false);
  };

  const createBill = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/payments/vendor/bill/create', newBill);
      toast.success(`Bill created! TDS: ₹${response.data.tds_details?.tds_amount || 0}`);
      setShowBillDialog(false);
      setNewBill({
        vendor_id: '', amount: 0, invoice_number: '',
        invoice_date: '', due_date: '', description: '', category: 'general'
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create bill');
    }
    setProcessing(false);
  };

  const approveBill = async (billId) => {
    try {
      await api.put(`/payments/vendor/bill/${billId}/approve`);
      toast.success('Bill approved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve bill');
    }
  };

  const processBulkPayment = async () => {
    if (selectedBills.length === 0) {
      toast.error('Select at least one bill');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await api.post('/payments/vendor/multi-gateway/payment', {
        gateway: selectedGateway,
        bill_ids: selectedBills,
        mode: selectedMode
      });
      toast.success(`Payment initiated! ${response.data.summary.successful} successful`);
      setSelectedBills([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Payment failed');
    }
    setProcessing(false);
  };

  const calculateTDS = async () => {
    try {
      const response = await api.post('/payments/tds/calculate', tdsCalc);
      setTdsResult(response.data);
    } catch (error) {
      toast.error('TDS calculation failed');
    }
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bill.bill_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-500', icon: Clock },
      approved: { color: 'bg-blue-500', icon: CheckCircle },
      unpaid: { color: 'bg-orange-500', icon: Clock },
      processing: { color: 'bg-blue-500', icon: RefreshCw },
      paid: { color: 'bg-green-500', icon: CheckCircle },
      cancelled: { color: 'bg-red-500', icon: XCircle }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

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
          <h2 className="text-2xl font-bold text-white">Vendor Bill Payment</h2>
          <p className="text-slate-400">Manage vendors and process payments with TDS</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showTDSCalculator} onOpenChange={setShowTDSCalculator}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <Calculator className="h-4 w-4 mr-2" />
                TDS Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">TDS Calculator</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Vendor Type</label>
                    <Select value={tdsCalc.vendor_type} onValueChange={(v) => setTdsCalc({...tdsCalc, vendor_type: v})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="individual" className="text-white">Individual</SelectItem>
                        <SelectItem value="company" className="text-white">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">TDS Section</label>
                    <Select value={tdsCalc.tds_section} onValueChange={(v) => setTdsCalc({...tdsCalc, tds_section: v})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {tdsSections.map(s => (
                          <SelectItem key={s.code} value={s.code} className="text-white">
                            {s.code} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Amount (₹)</label>
                  <Input 
                    type="number" 
                    value={tdsCalc.amount}
                    onChange={(e) => setTdsCalc({...tdsCalc, amount: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={tdsCalc.has_pan}
                    onCheckedChange={(v) => setTdsCalc({...tdsCalc, has_pan: v})}
                  />
                  <label className="text-sm text-slate-400">Has PAN Number</label>
                </div>
                <Button onClick={calculateTDS} className="w-full bg-emerald-600">
                  Calculate TDS
                </Button>
                
                {tdsResult && (
                  <div className="bg-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">TDS Section:</span>
                      <span className="text-white">{tdsResult.tds_section}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rate:</span>
                      <span className="text-white">{tdsResult.rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">TDS Amount:</span>
                      <span className="text-red-400 font-semibold">₹{tdsResult.tds_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-2">
                      <span className="text-slate-400">Net Payable:</span>
                      <span className="text-emerald-400 font-bold">₹{tdsResult.net_payable?.toLocaleString()}</span>
                    </div>
                    {tdsResult.no_pan_higher_rate && (
                      <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-2">
                        <AlertDescription className="text-yellow-400 text-sm">
                          Higher rate applied due to missing PAN
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-500 text-emerald-400">
                <Building2 className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Vendor</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4 max-h-96 overflow-y-auto">
                <div>
                  <label className="text-sm text-slate-400">Vendor Name *</label>
                  <Input 
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Type *</label>
                  <Select value={newVendor.type} onValueChange={(v) => setNewVendor({...newVendor, type: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="individual" className="text-white">Individual</SelectItem>
                      <SelectItem value="company" className="text-white">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">PAN Number</label>
                  <Input 
                    value={newVendor.pan_number}
                    onChange={(e) => setNewVendor({...newVendor, pan_number: e.target.value.toUpperCase()})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">GST Number</label>
                  <Input 
                    value={newVendor.gst_number}
                    onChange={(e) => setNewVendor({...newVendor, gst_number: e.target.value.toUpperCase()})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Email</label>
                  <Input 
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Phone</label>
                  <Input 
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({...newVendor, phone: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-slate-400">Address</label>
                  <Input 
                    value={newVendor.address}
                    onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="col-span-2 border-t border-slate-700 pt-4">
                  <h4 className="text-white font-medium mb-3">Bank Details</h4>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Bank Name *</label>
                  <Input 
                    value={newVendor.bank_name}
                    onChange={(e) => setNewVendor({...newVendor, bank_name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Account Number *</label>
                  <Input 
                    value={newVendor.account_number}
                    onChange={(e) => setNewVendor({...newVendor, account_number: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">IFSC Code *</label>
                  <Input 
                    value={newVendor.ifsc_code}
                    onChange={(e) => setNewVendor({...newVendor, ifsc_code: e.target.value.toUpperCase()})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="SBIN0001234"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Account Holder Name *</label>
                  <Input 
                    value={newVendor.account_holder_name}
                    onChange={(e) => setNewVendor({...newVendor, account_holder_name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="col-span-2 border-t border-slate-700 pt-4">
                  <h4 className="text-white font-medium mb-3">TDS Configuration</h4>
                </div>
                <div>
                  <label className="text-sm text-slate-400">TDS Section</label>
                  <Select value={newVendor.tds_section} onValueChange={(v) => setNewVendor({...newVendor, tds_section: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="none" className="text-white">None</SelectItem>
                      {tdsSections.map(s => (
                        <SelectItem key={s.code} value={s.code} className="text-white">
                          {s.code} - {s.name} ({s.individual_rate}%/{s.company_rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Custom TDS Rate (optional)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newVendor.tds_rate}
                    onChange={(e) => setNewVendor({...newVendor, tds_rate: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Leave 0 for default"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowVendorDialog(false)} className="border-slate-600 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={createVendor} disabled={processing} className="bg-emerald-600">
                  {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Vendor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <FileText className="h-4 w-4 mr-2" />
                Create Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create Vendor Bill</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm text-slate-400">Vendor *</label>
                  <Select value={newBill.vendor_id} onValueChange={(v) => setNewBill({...newBill, vendor_id: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-white">
                          {v.name} ({v.vendor_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Bill Amount (₹) *</label>
                  <Input 
                    type="number"
                    value={newBill.amount}
                    onChange={(e) => setNewBill({...newBill, amount: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Invoice Number</label>
                    <Input 
                      value={newBill.invoice_number}
                      onChange={(e) => setNewBill({...newBill, invoice_number: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Invoice Date</label>
                    <Input 
                      type="date"
                      value={newBill.invoice_date}
                      onChange={(e) => setNewBill({...newBill, invoice_date: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Description</label>
                  <Input 
                    value={newBill.description}
                    onChange={(e) => setNewBill({...newBill, description: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <AlertDescription className="text-blue-400 text-sm">
                    TDS will be automatically calculated based on vendor configuration
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBillDialog(false)} className="border-slate-600 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={createBill} disabled={processing || !newBill.vendor_id || !newBill.amount} className="bg-emerald-600">
                  {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Bill
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bills Section */}
      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="bills" className="data-[state=active]:bg-emerald-600">Bills</TabsTrigger>
          <TabsTrigger value="vendors" className="data-[state=active]:bg-emerald-600">Vendors</TabsTrigger>
          <TabsTrigger value="tds" className="data-[state=active]:bg-emerald-600">TDS Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-white">Vendor Bills</CardTitle>
                  <CardDescription className="text-slate-400">Manage and pay vendor bills with TDS deduction</CardDescription>
                </div>
                {selectedBills.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                      <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {gateways.map(g => (
                          <SelectItem key={g.name} value={g.name} className="text-white">{g.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={processBulkPayment} disabled={processing} className="bg-emerald-600">
                      <Send className="h-4 w-4 mr-2" />
                      Pay {selectedBills.length} Bills
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search bills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-white">All Status</SelectItem>
                    <SelectItem value="unpaid" className="text-white">Unpaid</SelectItem>
                    <SelectItem value="processing" className="text-white">Processing</SelectItem>
                    <SelectItem value="paid" className="text-white">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400 w-12">
                      <Checkbox 
                        checked={selectedBills.length === filteredBills.filter(b => b.status === 'approved' && b.payment_status === 'unpaid').length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedBills(filteredBills.filter(b => b.status === 'approved' && b.payment_status === 'unpaid').map(b => b.id));
                          } else {
                            setSelectedBills([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Bill Number</TableHead>
                    <TableHead className="text-slate-400">Vendor</TableHead>
                    <TableHead className="text-slate-400">Gross Amount</TableHead>
                    <TableHead className="text-slate-400">TDS</TableHead>
                    <TableHead className="text-slate-400">Net Payable</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map(bill => (
                    <TableRow key={bill.id} className="border-slate-700">
                      <TableCell>
                        {bill.status === 'approved' && bill.payment_status === 'unpaid' && (
                          <Checkbox 
                            checked={selectedBills.includes(bill.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedBills([...selectedBills, bill.id]);
                              } else {
                                setSelectedBills(selectedBills.filter(id => id !== bill.id));
                              }
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-white font-mono">{bill.bill_number}</TableCell>
                      <TableCell className="text-slate-300">{bill.vendor_name}</TableCell>
                      <TableCell className="text-white">₹{bill.gross_amount?.toLocaleString()}</TableCell>
                      <TableCell className="text-red-400">
                        {bill.tds_applicable ? (
                          <span className="flex items-center">
                            <Percent className="h-3 w-3 mr-1" />
                            ₹{bill.tds_amount?.toLocaleString()}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-emerald-400 font-semibold">
                        ₹{bill.net_payable?.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.payment_status || bill.status)}</TableCell>
                      <TableCell>
                        {bill.status === 'pending' && (
                          <Button size="sm" onClick={() => approveBill(bill.id)} className="bg-blue-600">
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBills.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                        No bills found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Vendors ({vendors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map(vendor => (
                  <div key={vendor.id} className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-white font-medium">{vendor.name}</h4>
                        <p className="text-slate-400 text-sm">{vendor.vendor_code}</p>
                      </div>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {vendor.type}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      {vendor.pan_number && (
                        <p className="text-slate-400">PAN: <span className="text-white">{vendor.pan_number}</span></p>
                      )}
                      {vendor.tds_section !== 'none' && (
                        <p className="text-slate-400">TDS: <span className="text-yellow-400">{vendor.tds_section} @ {vendor.tds_rate}%</span></p>
                      )}
                      <p className="text-slate-400">Bank: <span className="text-white">{vendor.bank_name}</span></p>
                    </div>
                  </div>
                ))}
                {vendors.length === 0 && (
                  <div className="col-span-3 text-center text-slate-400 py-8">
                    No vendors found. Add your first vendor.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tds">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">TDS Summary</CardTitle>
              <CardDescription className="text-slate-400">Tax Deducted at Source overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tdsSections.map(section => (
                  <div key={section.code} className="bg-slate-800 rounded-lg p-4">
                    <p className="text-emerald-400 font-semibold">{section.code}</p>
                    <p className="text-white text-sm">{section.name}</p>
                    <div className="mt-2 text-xs text-slate-400">
                      <p>Individual: {section.individual_rate}%</p>
                      <p>Company: {section.company_rate}%</p>
                      <p>Threshold: ₹{section.threshold?.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorBillPayment;