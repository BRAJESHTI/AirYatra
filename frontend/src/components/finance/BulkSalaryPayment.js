import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Banknote, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send,
  AlertTriangle,
  RefreshCw,
  FileText,
  Building,
  CreditCard
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const BulkSalaryPayment = () => {
  const [salaryRuns, setSalaryRuns] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('razorpayx');
  const [selectedMode, setSelectedMode] = useState('NEFT');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [approvalComments, setApprovalComments] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [runsRes, approvalsRes, gatewaysRes] = await Promise.all([
        api.get('/payments/salary/auto-runs'),
        api.get('/payments/approval/pending'),
        api.get('/payments/gateways/available')
      ]);
      setSalaryRuns(runsRes.data.salary_runs || []);
      setPendingApprovals(approvalsRes.data.pending_approvals || []);
      setGateways(gatewaysRes.data.gateways || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const createSalaryRun = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/payments/salary/auto-run', {
        month: selectedMonth,
        year: selectedYear,
        gateway: selectedGateway,
        mode: selectedMode
      });
      toast.success('Salary run created and sent for approval!');
      setShowCreateDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create salary run');
    }
    setProcessing(false);
  };

  const executeSalaryRun = async (runId) => {
    setProcessing(true);
    try {
      const response = await api.post(`/payments/salary/auto-run/${runId}/execute`);
      toast.success('Salary run executed successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to execute salary run');
    }
    setProcessing(false);
  };

  const handleApproval = async (approvalId, action, role) => {
    setProcessing(true);
    try {
      let endpoint = `/payments/approval/${approvalId}/approve/${role}`;
      if (action === 'reject') {
        endpoint = `/payments/approval/${approvalId}/reject`;
      } else if (action === 'override') {
        endpoint = `/payments/approval/${approvalId}/admin-override`;
      }
      
      await api.post(endpoint, {
        comments: approvalComments,
        reason: approvalComments
      });
      
      toast.success(`Approval ${action === 'reject' ? 'rejected' : 'completed'}!`);
      setApprovalComments('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
    setProcessing(false);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_approval: { color: 'bg-yellow-500', icon: Clock, text: 'Pending Approval' },
      pending_hr: { color: 'bg-orange-500', icon: Clock, text: 'Pending HR' },
      pending_finance: { color: 'bg-blue-500', icon: Clock, text: 'Pending Finance' },
      pending_admin: { color: 'bg-purple-500', icon: Clock, text: 'Pending Admin' },
      approved: { color: 'bg-green-500', icon: CheckCircle, text: 'Approved' },
      processing: { color: 'bg-blue-500', icon: RefreshCw, text: 'Processing' },
      completed: { color: 'bg-green-600', icon: CheckCircle, text: 'Completed' },
      partially_completed: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Partially Done' },
      rejected: { color: 'bg-red-500', icon: XCircle, text: 'Rejected' },
      auto_approved: { color: 'bg-emerald-500', icon: CheckCircle, text: 'Admin Override' }
    };
    const config = statusConfig[status] || { color: 'bg-slate-500', icon: Clock, text: status };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.text}
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
          <h2 className="text-2xl font-bold text-white">Bulk Salary Payment</h2>
          <p className="text-slate-400">Multi-gateway salary disbursement with approval workflow</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Banknote className="h-4 w-4 mr-2" />
              Create Salary Run
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Salary Run</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Month</label>
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {months.map(m => (
                        <SelectItem key={m.value} value={String(m.value)} className="text-white">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Year</label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
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
              
              <div>
                <label className="text-sm text-slate-400">Payment Gateway</label>
                <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {gateways.map(g => (
                      <SelectItem key={g.name} value={g.name} className="text-white">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-2" />
                          {g.display_name}
                          {g.is_mock && <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs">Demo</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Payment Mode</label>
                <Select value={selectedMode} onValueChange={setSelectedMode}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="NEFT" className="text-white">NEFT (Batch)</SelectItem>
                    <SelectItem value="RTGS" className="text-white">RTGS (High Value)</SelectItem>
                    <SelectItem value="IMPS" className="text-white">IMPS (Instant)</SelectItem>
                    <SelectItem value="UPI" className="text-white">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/30">
                <AlertDescription className="text-blue-400 text-sm">
                  <strong>Approval Flow:</strong> HR → Finance → Admin → Auto Transfer
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={createSalaryRun} disabled={processing} className="bg-emerald-600">
                {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Create & Send for Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.filter(a => a.type === 'salary_run').length > 0 && (
        <Card className="bg-slate-900 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Clock className="h-5 w-5 mr-2 text-yellow-500" />
              Pending Approvals ({pendingApprovals.filter(a => a.type === 'salary_run').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingApprovals.filter(a => a.type === 'salary_run').map(approval => (
                <div key={approval.id} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{approval.request_number}</p>
                      <p className="text-slate-400 text-sm">
                        {approval.details?.month}/{approval.details?.year} • {approval.details?.employee_count} employees
                      </p>
                      <p className="text-emerald-400 font-semibold">₹{approval.amount?.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(approval.status)}
                    </div>
                  </div>
                  
                  {/* Approval Actions */}
                  <div className="mt-4 flex items-center space-x-2">
                    <Textarea 
                      placeholder="Comments (optional)"
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white text-sm h-10"
                    />
                    
                    {approval.status === 'pending_hr' && (
                      <Button onClick={() => handleApproval(approval.id, 'approve', 'hr')} size="sm" className="bg-green-600">
                        HR Approve
                      </Button>
                    )}
                    {approval.status === 'pending_finance' && (
                      <Button onClick={() => handleApproval(approval.id, 'approve', 'finance')} size="sm" className="bg-blue-600">
                        Finance Approve
                      </Button>
                    )}
                    {approval.status === 'pending_admin' && (
                      <Button onClick={() => handleApproval(approval.id, 'approve', 'admin')} size="sm" className="bg-purple-600">
                        Admin Approve
                      </Button>
                    )}
                    
                    <Button onClick={() => handleApproval(approval.id, 'override', 'admin')} size="sm" variant="outline" className="border-emerald-500 text-emerald-400">
                      Admin Override
                    </Button>
                    
                    <Button onClick={() => handleApproval(approval.id, 'reject', '')} size="sm" variant="destructive">
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary Runs Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Salary Runs</CardTitle>
          <CardDescription className="text-slate-400">All salary disbursement runs</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Run Number</TableHead>
                <TableHead className="text-slate-400">Period</TableHead>
                <TableHead className="text-slate-400">Employees</TableHead>
                <TableHead className="text-slate-400">Amount</TableHead>
                <TableHead className="text-slate-400">Gateway</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaryRuns.map(run => (
                <TableRow key={run.id} className="border-slate-700">
                  <TableCell className="text-white font-mono">{run.run_number}</TableCell>
                  <TableCell className="text-slate-300">
                    {months.find(m => m.value === run.month)?.label} {run.year}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-blue-400" />
                      {run.employee_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-emerald-400 font-semibold">
                    ₹{run.total_net?.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      <CreditCard className="h-3 w-3 mr-1" />
                      {run.gateway?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>
                    {(run.status === 'approved' || run.status === 'auto_approved') && (
                      <Button 
                        onClick={() => executeSalaryRun(run.id)} 
                        size="sm" 
                        className="bg-emerald-600"
                        disabled={processing}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Execute
                      </Button>
                    )}
                    {run.status === 'completed' && (
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                        <FileText className="h-3 w-3 mr-1" />
                        View Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {salaryRuns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                    No salary runs found. Create your first salary run.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gateway Info */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Available Payment Gateways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {gateways.map(gateway => (
              <div key={gateway.name} className={`p-4 rounded-lg border ${gateway.is_configured ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Building className={`h-5 w-5 ${gateway.is_configured ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {gateway.is_mock && <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Demo</Badge>}
                </div>
                <p className="text-white font-medium text-sm">{gateway.display_name}</p>
                <p className={`text-xs ${gateway.is_configured ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {gateway.is_configured ? 'Configured' : 'Not Configured'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkSalaryPayment;