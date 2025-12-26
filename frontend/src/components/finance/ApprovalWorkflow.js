import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  Shield,
  Users,
  Banknote,
  RefreshCw,
  AlertTriangle,
  History,
  Zap
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const ApprovalWorkflow = ({ userRole }) => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [comments, setComments] = useState({});

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/payments/approval/pending'),
        api.get('/payments/approval/history')
      ]);
      setPendingApprovals(pendingRes.data.pending_approvals || []);
      setApprovalHistory(historyRes.data.history || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const handleApprove = async (approvalId, role) => {
    setProcessing(true);
    try {
      await api.post(`/payments/approval/${approvalId}/approve/${role}`, {
        comments: comments[approvalId] || ''
      });
      toast.success('Approved successfully!');
      fetchApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Approval failed');
    }
    setProcessing(false);
  };

  const handleAdminOverride = async (approvalId) => {
    setProcessing(true);
    try {
      await api.post(`/payments/approval/${approvalId}/admin-override`, {
        reason: comments[approvalId] || 'Admin override'
      });
      toast.success('Admin override approved!');
      fetchApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Override failed');
    }
    setProcessing(false);
  };

  const handleReject = async (approvalId) => {
    if (!comments[approvalId]) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setProcessing(true);
    try {
      await api.post(`/payments/approval/${approvalId}/reject`, {
        reason: comments[approvalId]
      });
      toast.success('Rejected');
      fetchApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Rejection failed');
    }
    setProcessing(false);
  };

  const getStatusBadge = (status) => {
    const config = {
      pending_hr: { color: 'bg-orange-500', icon: Users, text: 'Pending HR' },
      pending_finance: { color: 'bg-blue-500', icon: Banknote, text: 'Pending Finance' },
      pending_admin: { color: 'bg-purple-500', icon: Shield, text: 'Pending Admin' },
      approved: { color: 'bg-green-500', icon: CheckCircle, text: 'Approved' },
      auto_approved: { color: 'bg-emerald-500', icon: Zap, text: 'Admin Override' },
      rejected: { color: 'bg-red-500', icon: XCircle, text: 'Rejected' }
    };
    const c = config[status] || { color: 'bg-slate-500', icon: Clock, text: status };
    const Icon = c.icon;
    return (
      <Badge className={`${c.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {c.text}
      </Badge>
    );
  };

  const getTypeIcon = (type) => {
    const icons = {
      salary_run: Banknote,
      vendor_payment: Users,
      bulk_transfer: ArrowRight
    };
    return icons[type] || Clock;
  };

  const canApprove = (approval) => {
    const roleMap = {
      pending_hr: ['hr', 'admin', 'super_admin'],
      pending_finance: ['finance', 'admin', 'super_admin'],
      pending_admin: ['admin', 'super_admin']
    };
    return roleMap[approval.status]?.includes(userRole);
  };

  const getApprovalRole = (status) => {
    const roleMap = {
      pending_hr: 'hr',
      pending_finance: 'finance',
      pending_admin: 'admin'
    };
    return roleMap[status];
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
      <div>
        <h2 className="text-2xl font-bold text-white">Approval Workflow</h2>
        <p className="text-slate-400">Multi-level approval system: HR → Finance → Admin</p>
      </div>

      {/* Workflow Diagram */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
                <Users className="h-8 w-8 text-orange-400" />
              </div>
              <p className="text-white mt-2 font-medium">HR</p>
              <p className="text-slate-400 text-xs">First Level</p>
            </div>
            <ArrowRight className="h-6 w-6 text-slate-600" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                <Banknote className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-white mt-2 font-medium">Finance</p>
              <p className="text-slate-400 text-xs">Second Level</p>
            </div>
            <ArrowRight className="h-6 w-6 text-slate-600" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-purple-400" />
              </div>
              <p className="text-white mt-2 font-medium">Admin</p>
              <p className="text-slate-400 text-xs">Final Approval</p>
            </div>
            <ArrowRight className="h-6 w-6 text-slate-600" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-white mt-2 font-medium">Execute</p>
              <p className="text-slate-400 text-xs">Auto Transfer</p>
            </div>
          </div>
          
          {/* Admin Override Note */}
          <Alert className="mt-6 bg-emerald-500/10 border-emerald-500/30">
            <Zap className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-emerald-400">
              <strong>Admin Override:</strong> Admins can bypass HR/Finance approval and directly approve for immediate execution.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="pending" className="data-[state=active]:bg-emerald-600">
            Pending ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-emerald-600">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Pending Approvals</CardTitle>
              <CardDescription className="text-slate-400">Requests awaiting your approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-400">No pending approvals! You're all caught up.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map(approval => {
                    const TypeIcon = getTypeIcon(approval.type);
                    return (
                      <div key={approval.id} className="bg-slate-800 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                              <TypeIcon className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{approval.request_number}</p>
                              <p className="text-slate-400 text-sm capitalize">{approval.type?.replace('_', ' ')}</p>
                              <p className="text-emerald-400 font-semibold mt-1">₹{approval.amount?.toLocaleString()}</p>
                              <p className="text-slate-500 text-xs mt-1">By: {approval.requestor_name}</p>
                            </div>
                          </div>
                          {getStatusBadge(approval.status)}
                        </div>

                        {/* Approval Trail */}
                        <div className="mt-4 flex items-center space-x-2 text-xs">
                          <span className={`px-2 py-1 rounded ${approval.hr_approval ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            HR {approval.hr_approval ? '✓' : '○'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className={`px-2 py-1 rounded ${approval.finance_approval ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            Finance {approval.finance_approval ? '✓' : '○'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className={`px-2 py-1 rounded ${approval.admin_approval ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            Admin {approval.admin_approval ? '✓' : '○'}
                          </span>
                        </div>

                        {/* Actions */}
                        {canApprove(approval) && (
                          <div className="mt-4 space-y-3">
                            <Textarea
                              placeholder="Comments (required for rejection)"
                              value={comments[approval.id] || ''}
                              onChange={(e) => setComments({...comments, [approval.id]: e.target.value})}
                              className="bg-slate-700 border-slate-600 text-white text-sm"
                              rows={2}
                            />
                            <div className="flex items-center space-x-2">
                              <Button 
                                onClick={() => handleApprove(approval.id, getApprovalRole(approval.status))}
                                disabled={processing}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              
                              {['admin', 'super_admin'].includes(userRole) && approval.status !== 'pending_admin' && (
                                <Button 
                                  onClick={() => handleAdminOverride(approval.id)}
                                  disabled={processing}
                                  variant="outline"
                                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <Zap className="h-4 w-4 mr-2" />
                                  Admin Override
                                </Button>
                              )}
                              
                              <Button 
                                onClick={() => handleReject(approval.id)}
                                disabled={processing}
                                variant="destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {!canApprove(approval) && (
                          <Alert className="mt-4 bg-yellow-500/10 border-yellow-500/30">
                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                            <AlertDescription className="text-yellow-400 text-sm">
                              Waiting for {approval.status?.replace('pending_', '').toUpperCase()} approval
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <History className="h-5 w-5 mr-2" />
                Approval History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Request</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-slate-400">Requestor</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalHistory.map(item => (
                    <TableRow key={item.id} className="border-slate-700">
                      <TableCell className="text-white font-mono">{item.request_number}</TableCell>
                      <TableCell className="text-slate-300 capitalize">{item.type?.replace('_', ' ')}</TableCell>
                      <TableCell className="text-emerald-400">₹{item.amount?.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-300">{item.requestor_name}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {approvalHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                        No approval history found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalWorkflow;