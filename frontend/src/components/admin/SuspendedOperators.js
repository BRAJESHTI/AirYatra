import React, { useState, useEffect } from 'react';
import { Ban, CheckCircle, History, AlertTriangle, Building2, Clock, User, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { operatorManagementAPI } from '@/services/api';
import { toast } from 'sonner';

function SuspendedOperators() {
  const [suspendedOperators, setSuspendedOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [activationNotes, setActivationNotes] = useState('');

  useEffect(() => {
    loadSuspendedOperators();
  }, []);

  const loadSuspendedOperators = async () => {
    try {
      const response = await operatorManagementAPI.getSuspended();
      setSuspendedOperators(response.data.suspended_operators || []);
    } catch (error) {
      toast.error('Failed to load suspended operators');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedOperator) return;
    
    try {
      await operatorManagementAPI.activateOperator(selectedOperator.id, { notes: activationNotes });
      toast.success('Operator activated successfully');
      setShowActivateDialog(false);
      setActivationNotes('');
      loadSuspendedOperators();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to activate operator');
    }
  };

  const openHistoryDialog = (operator) => {
    setSelectedOperator(operator);
    setShowHistoryDialog(true);
  };

  const openActivateDialog = (operator) => {
    setSelectedOperator(operator);
    setShowActivateDialog(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Ban className="h-6 w-6 text-red-400" />
            Suspended Operators
          </h2>
          <p className="text-slate-400">View and manage suspended operators</p>
        </div>
        <Button onClick={loadSuspendedOperators} variant="outline" className="border-slate-700">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400 text-sm">Total Suspended</p>
          <p className="text-2xl font-bold text-white">{suspendedOperators.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm">Temporary Suspensions</p>
          <p className="text-2xl font-bold text-white">
            {suspendedOperators.filter(o => o.suspension_type === 'temporary').length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <p className="text-orange-400 text-sm">Permanent Suspensions</p>
          <p className="text-2xl font-bold text-white">
            {suspendedOperators.filter(o => o.suspension_type === 'permanent').length}
          </p>
        </div>
      </div>

      {/* Suspended Operators List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : suspendedOperators.length === 0 ? (
        <div className="p-8 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-white font-medium">No Suspended Operators</p>
          <p className="text-slate-400 text-sm"></p>
        </div>
      ) : (
        <div className="space-y-4">
          {suspendedOperators.map((operator) => (
            <div key={operator.id} className="p-6 rounded-lg bg-slate-900/50 border border-red-500/30">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-red-500/20">
                    <Building2 className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{operator.company_name}</h3>
                    <p className="text-slate-400 text-sm">{operator.user_email}</p>
                    <p className="text-slate-500 text-xs">{operator.base_city} | {operator.region || 'No Region'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openHistoryDialog(operator)}
                    className="border-slate-700"
                  >
                    <History className="h-4 w-4 mr-1" />
                    History
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => openActivateDialog(operator)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                </div>
              </div>

              {/* Suspension Details */}
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-slate-500 text-xs">Suspension Type</p>
                    <p className={`font-medium ${operator.suspension_type === 'permanent' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {operator.suspension_type === 'permanent' ? 'Permanent' : 'Temporary'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Suspended On</p>
                    <p className="text-white font-medium">{formatDate(operator.suspended_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Suspended By</p>
                    <p className="text-white font-medium">{operator.suspended_by_name || 'System'}</p>
                  </div>
                  {operator.suspension_end_date && (
                    <div>
                      <p className="text-slate-500 text-xs">Suspension Ends</p>
                      <p className="text-yellow-400 font-medium">{formatDate(operator.suspension_end_date)}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-red-500/20">
                  <p className="text-slate-500 text-xs mb-1">Suspension Reason</p>
                  <p className="text-red-300 bg-red-500/10 p-3 rounded">
                    <AlertTriangle className="inline h-4 w-4 mr-2" />
                    {operator.suspension_reason || 'No reason provided'}
                  </p>
                </div>
              </div>

              {/* Operator Stats */}
              <div className="flex gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="h-4 w-4" />
                  <span>{operator.statistics?.booking_count || 0} Bookings</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="h-4 w-4" />
                  <span>{operator.statistics?.pilot_count || 0} Pilots</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activate Dialog */}
      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Activate Operator</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-white font-medium">{selectedOperator?.company_name}</p>
              <p className="text-slate-400 text-sm">Current Status: Suspended</p>
              <p className="text-red-400 text-sm mt-2">
                Reason: {selectedOperator?.suspension_reason}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">Activation Notes (Optional)</Label>
              <textarea
                value={activationNotes}
                onChange={(e) => setActivationNotes(e.target.value)}
                placeholder="Enter notes for activating this operator..."
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm">
                ⚠️ This will immediately reactivate the operator and they will be able to accept bookings.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowActivateDialog(false)}>Cancel</Button>
            <Button onClick={handleActivate} className="bg-green-600 hover:bg-green-700">
              Activate Operator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="h-5 w-5 text-orange-400" />
              Suspension History</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-white font-medium">{selectedOperator?.company_name}</p>
              <p className="text-slate-400 text-sm">{selectedOperator?.user_email}</p>
            </div>
            
            {selectedOperator?.suspension_history?.length > 0 ? (
              selectedOperator.suspension_history.map((record, index) => (
                <div 
                  key={record.id || index} 
                  className={`p-4 rounded-lg border ${
                    record.action === 'suspended' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${record.action === 'suspended' ? 'text-red-400' : 'text-green-400'}`}>
                        {record.action === 'suspended' ? '🚫 Suspended' : '✅ Activated'}
                      </p>
                      <p className="text-slate-400 text-sm mt-1">{record.reason || 'No reason provided'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-300 text-sm">{record.actioned_by_name}</p>
                      <p className="text-slate-500 text-xs">{formatDate(record.created_at)}</p>
                    </div>
                  </div>
                  {record.suspension_type && (
                    <p className="text-slate-500 text-xs mt-2">
                      Type: {record.suspension_type} | Duration: {record.duration_days ? `${record.duration_days} days` : 'N/A'}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-4">No history available</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuspendedOperators;
