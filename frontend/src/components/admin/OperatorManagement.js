import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, Plane, Users, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminAPI } from '@/services/api';

function OperatorManagement() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyAction, setVerifyAction] = useState(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadOperators();
  }, [filter]);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await adminAPI.getOperators(status);
      setOperators(response.data.operators || []);
    } catch (error) {
      console.error('Failed to load operators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedOperator || !verifyAction) return;
    setProcessing(true);
    try {
      await adminAPI.verifyOperator(selectedOperator.id, {
        status: verifyAction,
        notes: verifyNotes
      });
      setShowVerifyDialog(false);
      setSelectedOperator(null);
      setVerifyNotes('');
      loadOperators();
    } catch (error) {
      console.error('Failed to verify operator:', error);
    } finally {
      setProcessing(false);
    }
  };

  const openVerifyDialog = (operator, action) => {
    setSelectedOperator(operator);
    setVerifyAction(action);
    setShowVerifyDialog(true);
  };

  const filteredOperators = operators.filter(op => 
    op.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      suspended: 'bg-red-500/20 text-red-400',
    };
    return badges[status] || badges.pending;
  };

  const getVerificationBadge = (status) => {
    const badges = {
      approved: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Operator Management</h1>
        <p className="text-slate-400 mt-1">Verify and manage helicopter operators</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search operators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'active', 'suspended'].map(status => (
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
      </div>

      {/* Operators Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading operators...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOperators.map((operator) => (
            <div key={operator.id} className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-orange-400" />
                    {operator.company_name}
                  </h3>
                  <p className="text-sm text-slate-400">{operator.user_email}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(operator.status)}`}>
                    {operator.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getVerificationBadge(operator.verification_status)}`}>
                    {operator.verification_status || 'pending'}
                  </span>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-cyan-400" />
                    <span className="text-white font-semibold">{operator.statistics?.aircraft_count || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Aircraft</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-white font-semibold">{operator.statistics?.pilot_count || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Pilots</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-400" />
                    <span className="text-white font-semibold">{operator.statistics?.booking_count || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Bookings</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="text-sm text-slate-400 mb-4">
                <p>Phone: {operator.user_phone || 'N/A'}</p>
                <p>Region: {operator.region || 'N/A'}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {operator.verification_status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => openVerifyDialog(operator, 'approved')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openVerifyDialog(operator, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={() => setSelectedOperator(operator)}
                >
                  <Eye className="h-4 w-4 mr-1" /> View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {verifyAction === 'approved' ? 'Approve' : 'Reject'} Operator
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              You are about to {verifyAction === 'approved' ? 'approve' : 'reject'} <strong className="text-white">{selectedOperator?.company_name}</strong>
            </p>
            <label className="block text-sm text-slate-400 mb-2">Notes (Optional)</label>
            <textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
              rows={3}
              placeholder="Add any notes for this decision..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={processing}
              className={verifyAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processing...' : verifyAction === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OperatorManagement;
