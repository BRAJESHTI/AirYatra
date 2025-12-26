import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Eye, Download, FileSpreadsheet, FileText, X, Building2, Phone, Mail, MapPin, Calendar, Plane, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminAPI } from '@/services/api';
import { toast } from 'sonner';

function OperatorManagement() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
      toast.error('Failed to load operators');
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
      toast.success(`Operator ${verifyAction === 'approved' ? 'approved' : 'rejected'} successfully`);
      setShowVerifyDialog(false);
      setSelectedOperator(null);
      setVerifyNotes('');
      loadOperators();
    } catch (error) {
      console.error('Failed to verify operator:', error);
      toast.error('Failed to verify operator');
    } finally {
      setProcessing(false);
    }
  };

  const openVerifyDialog = (operator, action) => {
    setSelectedOperator(operator);
    setVerifyAction(action);
    setShowVerifyDialog(true);
  };

  const openDetailsModal = (operator) => {
    setSelectedOperator(operator);
    setShowDetailsModal(true);
  };

  const filteredOperators = operators.filter(op => 
    op.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.base_city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
      verified: 'bg-green-500/20 text-green-400 border-green-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return badges[status] || badges.pending;
  };

  // Download as Excel
  const downloadExcel = () => {
    const headers = ['Sr No', 'Company Name', 'Email', 'Phone', 'City', 'State', 'Status', 'Verification', 'Aircraft', 'Pilots', 'Bookings', 'Rating', 'Created Date'];
    const rows = filteredOperators.map((op, index) => [
      index + 1,
      op.company_name || '',
      op.user_email || op.contact_email || '',
      op.user_phone || op.contact_phone || '',
      op.base_city || '',
      op.base_state || '',
      op.status || '',
      op.verification_status || '',
      op.statistics?.aircraft_count || 0,
      op.statistics?.pilot_count || 0,
      op.statistics?.booking_count || 0,
      op.rating || 'N/A',
      op.created_at ? new Date(op.created_at).toLocaleDateString() : ''
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operators_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel file downloaded!');
  };

  // Download as PDF (using print)
  const downloadPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>Operator Management Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f97316; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .status-active { color: green; font-weight: bold; }
            .status-pending { color: orange; font-weight: bold; }
            .status-suspended { color: red; font-weight: bold; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>🚁 AirYatra - Operator Management Report</h1>
          <p style="text-align: center; color: #666;">Generated on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Sr</th>
                <th>Company Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Aircraft</th>
                <th>Bookings</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOperators.map((op, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${op.company_name || '-'}</td>
                  <td>${op.user_email || op.contact_email || '-'}</td>
                  <td>${op.user_phone || op.contact_phone || '-'}</td>
                  <td>${op.base_city || '-'}</td>
                  <td class="status-${op.status}">${op.status || '-'}</td>
                  <td class="status-${op.verification_status}">${op.verification_status || '-'}</td>
                  <td>${op.statistics?.aircraft_count || 0}</td>
                  <td>${op.statistics?.booking_count || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Total Operators: ${filteredOperators.length} | AirYatra Helicopter Services</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    toast.success('PDF print dialog opened!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Operator Management</h1>
          <p className="text-slate-400 text-sm">Manage and verify helicopter operators</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadExcel} variant="outline" className="border-green-600 text-green-400 hover:bg-green-600/20">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button onClick={downloadPDF} variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20">
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by company, email, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'active', 'suspended'].map(status => (
            <Button
              key={status}
              size="sm"
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              className={filter === status ? 'bg-orange-500 hover:bg-orange-600' : 'border-slate-600 text-slate-300'}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-2xl font-bold text-white">{operators.length}</p>
          <p className="text-sm text-slate-400">Total Operators</p>
        </div>
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-2xl font-bold text-green-400">{operators.filter(o => o.status === 'active').length}</p>
          <p className="text-sm text-slate-400">Active</p>
        </div>
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-2xl font-bold text-yellow-400">{operators.filter(o => o.verification_status === 'pending').length}</p>
          <p className="text-sm text-slate-400">Pending Verification</p>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-2xl font-bold text-red-400">{operators.filter(o => o.status === 'suspended').length}</p>
          <p className="text-sm text-slate-400">Suspended</p>
        </div>
      </div>

      {/* Operators Table */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Sr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Stats</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">Loading operators...</td>
                </tr>
              ) : filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">No operators found</td>
                </tr>
              ) : (
                filteredOperators.map((operator, index) => (
                  <tr key={operator.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
                        <span className="text-white font-medium truncate max-w-[150px]">{operator.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="text-slate-300 truncate max-w-[150px]">{operator.user_email || operator.contact_email || '-'}</p>
                        <p className="text-slate-500 text-xs">{operator.user_phone || operator.contact_phone || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-300">{operator.base_city || '-'}, {operator.base_state || ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs border ${getStatusBadge(operator.status)}`}>
                          {operator.status || 'pending'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs border ${getStatusBadge(operator.verification_status)}`}>
                          {operator.verification_status || 'pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span title="Aircraft"><Plane className="h-3 w-3 inline mr-1" />{operator.statistics?.aircraft_count || 0}</span>
                        <span title="Pilots"><Users className="h-3 w-3 inline mr-1" />{operator.statistics?.pilot_count || 0}</span>
                        <span title="Bookings"><Calendar className="h-3 w-3 inline mr-1" />{operator.statistics?.booking_count || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                          onClick={() => openDetailsModal(operator)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {operator.verification_status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                              onClick={() => openVerifyDialog(operator, 'approved')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              onClick={() => openVerifyDialog(operator, 'rejected')}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer */}
        <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center">
          <p className="text-sm text-slate-400">
            Showing {filteredOperators.length} of {operators.length} operators
          </p>
        </div>
      </div>

      {/* View Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-6 w-6 text-orange-400" />
              {selectedOperator?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOperator && (
            <div className="space-y-6 py-4">
              {/* Status Badges */}
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-sm border ${getStatusBadge(selectedOperator.status)}`}>
                  Status: {selectedOperator.status || 'pending'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm border ${getStatusBadge(selectedOperator.verification_status)}`}>
                  Verification: {selectedOperator.verification_status || 'pending'}
                </span>
              </div>

              {/* Contact Information */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-400 mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">{selectedOperator.user_email || selectedOperator.contact_email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">{selectedOperator.user_phone || selectedOperator.contact_phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">{selectedOperator.base_city || 'N/A'}, {selectedOperator.base_state || ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-slate-300">Rating: {selectedOperator.rating || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-400 mb-3">Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <Plane className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{selectedOperator.statistics?.aircraft_count || 0}</p>
                    <p className="text-xs text-slate-400">Aircraft</p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <Users className="h-6 w-6 text-purple-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{selectedOperator.statistics?.pilot_count || 0}</p>
                    <p className="text-xs text-slate-400">Pilots</p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <Calendar className="h-6 w-6 text-green-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{selectedOperator.statistics?.booking_count || 0}</p>
                    <p className="text-xs text-slate-400">Bookings</p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-400 mb-3">Additional Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Operator ID</p>
                    <p className="text-slate-300 font-mono text-xs">{selectedOperator.id}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">User ID</p>
                    <p className="text-slate-300 font-mono text-xs">{selectedOperator.user_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Commission Rate</p>
                    <p className="text-slate-300">{selectedOperator.commission_rate || 10}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Created Date</p>
                    <p className="text-slate-300">{selectedOperator.created_at ? new Date(selectedOperator.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  {selectedOperator.base_latitude && (
                    <>
                      <div>
                        <p className="text-slate-400">Latitude</p>
                        <p className="text-slate-300">{selectedOperator.base_latitude}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Longitude</p>
                        <p className="text-slate-300">{selectedOperator.base_longitude}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Verification Notes */}
              {selectedOperator.verification_notes && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-orange-400 mb-2">Verification Notes</h3>
                  <p className="text-slate-300">{selectedOperator.verification_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)} className="border-slate-600 text-slate-300">
              Close
            </Button>
            {selectedOperator?.verification_status === 'pending' && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setShowDetailsModal(false);
                    openVerifyDialog(selectedOperator, 'approved');
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDetailsModal(false);
                    openVerifyDialog(selectedOperator, 'rejected');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verifyAction === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              {verifyAction === 'approved' ? 'Approve' : 'Reject'} Operator
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              You are about to {verifyAction === 'approved' ? 'approve' : 'reject'}{' '}
              <strong className="text-white">{selectedOperator?.company_name}</strong>
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
