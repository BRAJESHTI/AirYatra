import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2,
  Send,
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Users
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const VendorCompliance = () => {
  const [compliance, setCompliance] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [complianceRes, remindersRes] = await Promise.all([
        api.get(`/gst/vendors/compliance?month=${selectedMonth}&year=${selectedYear}`),
        api.get('/gst/vendors/reminders')
      ]);
      setCompliance(complianceRes.data);
      setReminders(remindersRes.data.reminders || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendReminder = async () => {
    if (!selectedVendor) return;
    setProcessing(true);
    try {
      await api.post(`/gst/vendors/${selectedVendor.vendor_id}/send-reminder`, {
        message: customMessage
      });
      toast.success(`Reminder sent to ${selectedVendor.vendor_name}!`);
      setShowReminderDialog(false);
      setSelectedVendor(null);
      setCustomMessage('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reminder');
    }
    setProcessing(false);
  };

  const sendBulkReminders = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/gst/vendors/send-bulk-reminders', {
        month: selectedMonth,
        year: selectedYear,
        min_compliance: 90
      });
      toast.success(`Sent ${response.data.sent} reminders to non-compliant vendors!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reminders');
    }
    setProcessing(false);
  };

  const getComplianceBadge = (score, status) => {
    if (status === 'compliant') {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />{score}%</Badge>;
    } else if (status === 'partial') {
      return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />{score}%</Badge>;
    } else {
      return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />{score}%</Badge>;
    }
  };

  const filteredVendors = compliance?.vendors?.filter(v => 
    v.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vendor_gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
          <h3 className="text-xl font-bold text-white">Vendor GST Compliance</h3>
          <p className="text-slate-400">Track vendor GSTR-1 filing & send reminders</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {months.map(m => (
                <SelectItem key={m.value} value={String(m.value)} className="text-white">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)} className="text-white">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={sendBulkReminders} disabled={processing} className="bg-red-600 hover:bg-red-700">
            <Mail className="h-4 w-4 mr-2" />
            Send Bulk Reminders
          </Button>
        </div>
      </div>

      {compliance && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <Users className="h-6 w-6 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">{compliance.summary?.total_vendors}</p>
                <p className="text-slate-400 text-sm">Total Vendors</p>
              </CardContent>
            </Card>
            
            <Card className="bg-green-500/20 border-green-500/30">
              <CardContent className="pt-6">
                <CheckCircle className="h-6 w-6 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">{compliance.summary?.compliant}</p>
                <p className="text-slate-400 text-sm">Compliant (90%+)</p>
              </CardContent>
            </Card>
            
            <Card className="bg-red-500/20 border-red-500/30">
              <CardContent className="pt-6">
                <XCircle className="h-6 w-6 text-red-400 mb-2" />
                <p className="text-2xl font-bold text-white">{compliance.summary?.non_compliant}</p>
                <p className="text-slate-400 text-sm">Non-Compliant</p>
              </CardContent>
            </Card>
            
            <Card className="bg-yellow-500/20 border-yellow-500/30">
              <CardContent className="pt-6">
                <AlertTriangle className="h-6 w-6 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{compliance.summary?.at_risk_itc?.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">At-Risk ITC</p>
              </CardContent>
            </Card>
          </div>

          {/* At-Risk Alert */}
          {compliance.summary?.at_risk_itc > 0 && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                <strong>Warning:</strong> ₹{compliance.summary.at_risk_itc.toLocaleString()} of your ITC is at risk due to vendors not filing their GSTR-1.
                This amount will not be available for credit until vendors file their returns.
              </AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search vendors by name or GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Vendors Table */}
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Vendor</TableHead>
                    <TableHead className="text-slate-400">GSTIN</TableHead>
                    <TableHead className="text-slate-400">Total Bills</TableHead>
                    <TableHead className="text-slate-400">GST Amount</TableHead>
                    <TableHead className="text-slate-400">Matched in GSTR-2A</TableHead>
                    <TableHead className="text-slate-400">Compliance</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map(vendor => (
                    <TableRow key={vendor.vendor_id} className="border-slate-700">
                      <TableCell>
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-slate-500 mr-2" />
                          <span className="text-white">{vendor.vendor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-sm">{vendor.vendor_gstin || '-'}</TableCell>
                      <TableCell className="text-white">{vendor.total_bills}</TableCell>
                      <TableCell className="text-yellow-400">₹{vendor.total_gst?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={vendor.compliance_score} className="w-20" />
                          <span className="text-emerald-400">{vendor.matched_in_gstr2a}</span>
                          <span className="text-slate-500">/</span>
                          <span className="text-slate-400">{vendor.total_bills}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getComplianceBadge(vendor.compliance_score, vendor.status)}</TableCell>
                      <TableCell>
                        {vendor.not_matched > 0 && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-red-500 text-red-400 hover:bg-red-500/20"
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setShowReminderDialog(true);
                            }}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Remind
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredVendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                        No vendors found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Reminders */}
          {reminders.length > 0 && (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Reminders Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reminders.slice(0, 5).map(reminder => (
                    <div key={reminder.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                      <div>
                        <p className="text-white">{reminder.vendor_name}</p>
                        <p className="text-slate-400 text-sm">{reminder.vendor_email}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-500">Sent</Badge>
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(reminder.sent_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Send Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Send GST Reminder</DialogTitle>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-white font-medium">{selectedVendor.vendor_name}</p>
                <p className="text-slate-400 text-sm">{selectedVendor.vendor_gstin}</p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-red-400">{selectedVendor.not_matched} bills not in GSTR-2A</span>
                  <span className="text-yellow-400">₹{selectedVendor.total_gst?.toLocaleString()} GST</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Custom Message (optional)</label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Add a custom message or leave blank for default template..."
                  rows={4}
                />
              </div>
              
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <AlertDescription className="text-blue-400 text-sm">
                  An email will be sent to the vendor requesting them to file their GSTR-1 for the missing invoices.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={sendReminder} disabled={processing} className="bg-red-600">
              {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorCompliance;