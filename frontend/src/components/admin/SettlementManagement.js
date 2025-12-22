import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, CreditCard, Eye, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminSettlementAPI, adminAPI } from '@/services/api';

function SettlementManagement() {
  const [settlements, setSettlements] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSettlements();
    loadOperators();
  }, [filter]);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await adminSettlementAPI.getAll(status);
      setSettlements(response.data.settlements || []);
    } catch (error) {
      console.error('Failed to load settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const response = await adminAPI.getOperators();
      setOperators(response.data.operators || []);
    } catch (error) {
      console.error('Failed to load operators:', error);
    }
  };

  const handleApprove = async () => {
    if (!selectedSettlement) return;
    setProcessing(true);
    try {
      await adminSettlementAPI.approve(selectedSettlement.id, { notes: approvalNotes });
      setShowApproveDialog(false);
      setSelectedSettlement(null);
      setApprovalNotes('');
      loadSettlements();
    } catch (error) {
      console.error('Failed to approve settlement:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedSettlement) return;
    setProcessing(true);
    try {
      await adminSettlementAPI.markPaid(selectedSettlement.id, {
        payment_reference: paymentRef,
        payment_method: paymentMethod
      });
      setShowPayDialog(false);
      setSelectedSettlement(null);
      setPaymentRef('');
      loadSettlements();
    } catch (error) {
      console.error('Failed to mark settlement as paid:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-green-500/20 text-green-400',
    };
    return badges[status] || badges.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate totals
  const totals = settlements.reduce((acc, s) => ({
    total: acc.total + (s.payout_amount || 0),
    pending: acc.pending + (s.status === 'pending' ? s.payout_amount || 0 : 0),
    approved: acc.approved + (s.status === 'approved' ? s.payout_amount || 0 : 0),
    paid: acc.paid + (s.status === 'paid' ? s.payout_amount || 0 : 0),
  }), { total: 0, pending: 0, approved: 0, paid: 0 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-400" />
            Settlement Management
          </h1>
          <p className="text-slate-400 mt-1">Manage operator payouts and settlements</p>
        </div>
        <Button onClick={loadSettlements} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <p className="text-sm text-slate-400">Total Settlements</p>
          <p className="text-2xl font-bold text-white">₹{totals.total.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-sm text-slate-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">₹{totals.pending.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-sm text-slate-400">Approved</p>
          <p className="text-2xl font-bold text-blue-400">₹{totals.approved.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <p className="text-sm text-slate-400">Paid</p>
          <p className="text-2xl font-bold text-green-400">₹{totals.paid.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'paid'].map(status => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => setFilter(status)}
            className={filter === status ? 'bg-orange-500 hover:bg-orange-600' : 'border-slate-600 text-slate-300'}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Settlements Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading settlements...</div>
      ) : settlements.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No settlements found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Settlement #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Operator</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Bookings</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Total Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Commission</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Payout</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {settlements.map((settlement) => (
                <tr key={settlement.id} className="bg-slate-900/30 hover:bg-slate-900/50">
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{settlement.settlement_number}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-orange-400" />
                      <span className="text-slate-300">{settlement.operator_name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-slate-300">{settlement.booking_ids?.length || 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-white">₹{(settlement.total_booking_amount || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-orange-400">₹{(settlement.commission_amount || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-green-400 font-semibold">₹{(settlement.payout_amount || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(settlement.status)}`}>
                      {settlement.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-slate-400 text-sm">{formatDate(settlement.created_at)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {settlement.status === 'pending' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedSettlement(settlement);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {settlement.status === 'approved' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setSelectedSettlement(settlement);
                            setShowPayDialog(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-white"
                        onClick={() => setSelectedSettlement(settlement)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Approve Settlement</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              Approve settlement <strong className="text-white">{selectedSettlement?.settlement_number}</strong> for ₹{(selectedSettlement?.payout_amount || 0).toLocaleString()}?
            </p>
            <label className="block text-sm text-slate-400 mb-2">Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
              rows={3}
              placeholder="Approval notes..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? 'Processing...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Mark Settlement as Paid</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-400">
              Mark settlement <strong className="text-white">{selectedSettlement?.settlement_number}</strong> as paid
            </p>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Payment Reference</label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
                placeholder="Transaction ID / Reference Number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? 'Processing...' : 'Mark as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SettlementManagement;
