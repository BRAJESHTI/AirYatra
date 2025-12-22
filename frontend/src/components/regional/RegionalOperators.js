import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Building2, Plane, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { regionalManagerAPI } from '@/services/api';
import { toast } from 'sonner';

function RegionalOperators({ region }) {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadOperators();
  }, [filter]);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await regionalManagerAPI.getOperators(status);
      setOperators(response.data.operators || []);
    } catch (error) {
      toast.error('Failed to load operators');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedOperator || !approvalAction) return;
    setProcessing(true);
    try {
      if (approvalAction === 'approve') {
        await regionalManagerAPI.approveOperator(selectedOperator.id, approvalNotes);
        toast.success('Operator approved');
      } else {
        await regionalManagerAPI.rejectOperator(selectedOperator.id, approvalNotes);
        toast.success('Operator rejected');
      }
      setShowApproveDialog(false);
      setSelectedOperator(null);
      setApprovalNotes('');
      loadOperators();
    } catch (error) {
      toast.error('Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const filteredOperators = operators.filter(op => 
    op.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Regional Operators</h1>
        <p className="text-slate-400 mt-1">Manage operators in {region || 'your region'}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search operators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'active'].map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              className={filter === status ? 'bg-purple-500 hover:bg-purple-600' : 'border-slate-600 text-slate-300'}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Operators Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOperators.map((operator) => (
            <div key={operator.id} className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-400" />
                    {operator.company_name}
                  </h3>
                  <p className="text-sm text-slate-400">{operator.user_email}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  operator.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {operator.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-cyan-400" />
                    <span className="text-white font-semibold">{operator.aircraft_count || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Aircraft</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-white font-semibold">{operator.pilot_count || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Pilots</p>
                </div>
              </div>

              {operator.verification_status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedOperator(operator);
                      setApprovalAction('approve');
                      setShowApproveDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedOperator(operator);
                      setApprovalAction('reject');
                      setShowApproveDialog(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{approvalAction === 'approve' ? 'Approve' : 'Reject'} Operator</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} <strong className="text-white">{selectedOperator?.company_name}</strong>?
            </p>
            <label className="block text-sm text-slate-400 mb-2">Notes</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              rows={3}
              placeholder={approvalAction === 'approve' ? 'Approval notes...' : 'Rejection reason...'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleApproval}
              disabled={processing || (approvalAction === 'reject' && !approvalNotes)}
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RegionalOperators;
