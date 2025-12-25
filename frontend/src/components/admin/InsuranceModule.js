import React, { useState, useEffect } from 'react';
import { Shield, FileText, DollarSign, Users, AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function InsuranceModule() {
  const [dashboard, setDashboard] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimFilter, setClaimFilter] = useState('');
  const [updateModal, setUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({ status: '', remarks: '', approved_amount: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, claimsRes] = await Promise.all([
        api.get('/api/insurance/admin/dashboard'),
        api.get('/api/insurance/admin/claims')
      ]);
      setDashboard(dashRes.data);
      setClaims(claimsRes.data.claims || []);
    } catch (error) {
      console.error('Failed to load insurance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredClaims = async (status) => {
    try {
      const res = await api.get(`/api/insurance/admin/claims${status ? `?status=${status}` : ''}`);
      setClaims(res.data.claims || []);
      setClaimFilter(status);
    } catch (error) {
      console.error('Failed to filter claims:', error);
    }
  };

  const openUpdateModal = (claim) => {
    setSelectedClaim(claim);
    setUpdateData({ status: claim.status, remarks: '', approved_amount: claim.approved_amount || '' });
    setUpdateModal(true);
  };

  const updateClaim = async () => {
    try {
      await api.put(`/api/insurance/admin/claims/${selectedClaim.id}`, {
        status: updateData.status,
        remarks: updateData.remarks || undefined,
        approved_amount: updateData.approved_amount ? parseFloat(updateData.approved_amount) : undefined
      });
      setUpdateModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to update claim:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-blue-500/20 text-blue-400';
      case 'under_review': return 'bg-yellow-500/20 text-yellow-400';
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'settled': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getClaimTypeIcon = (type) => {
    switch (type) {
      case 'medical': return '🏥';
      case 'cancellation': return '❌';
      case 'delay': return '⏰';
      case 'baggage': return '🧳';
      case 'death': return '⚠️';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Insurance Module</h1>
          <p className="text-slate-400">Manage travel insurance policies and claims</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {dashboard && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <FileText className="h-5 w-5" />
              <span className="text-sm">Total Policies</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.total_policies}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-green-400 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Active Policies</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.active_policies}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm">Premium Collected</span>
            </div>
            <p className="text-2xl font-bold text-white">₹{(dashboard.total_premium_collected || 0).toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-yellow-400 mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Pending Claims</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.pending_claims}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-purple-400 mb-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm">Claim Ratio</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.claim_ratio}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-700">
        {['dashboard', 'claims'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Insurance Plans */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
            <div className="space-y-3">
              {[
                { name: 'Basic Cover', coverage: '₹5 Lakh', premium: '0.5%', color: 'blue' },
                { name: 'Standard Cover', coverage: '₹15 Lakh', premium: '1.0%', color: 'green' },
                { name: 'Premium Cover', coverage: '₹50 Lakh', premium: '2.0%', color: 'purple' }
              ].map(plan => (
                <div key={plan.name} className={`p-4 bg-${plan.color}-500/10 border border-${plan.color}-500/30 rounded-lg`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{plan.name}</span>
                    <span className={`text-${plan.color}-400`}>{plan.premium} of booking</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">Coverage: {plan.coverage}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Claims */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Claims</h2>
            {dashboard?.recent_claims?.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recent_claims.map(claim => (
                  <div key={claim.claim_number} className="flex justify-between items-center p-3 bg-slate-900 rounded">
                    <div>
                      <p className="text-white font-medium">{claim.claim_number}</p>
                      <p className="text-slate-400 text-sm">{getClaimTypeIcon(claim.claim_type)} {claim.claim_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400">₹{claim.amount_claimed?.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No recent claims</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          {/* Filter */}
          <div className="p-4 border-b border-slate-700 flex space-x-2">
            {['', 'submitted', 'under_review', 'approved', 'rejected', 'settled'].map(status => (
              <button
                key={status}
                onClick={() => loadFilteredClaims(status)}
                className={`px-3 py-1 rounded-full text-sm ${claimFilter === status ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>

          {/* Claims Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-700">
                  <th className="text-left p-4">Claim #</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Customer</th>
                  <th className="text-right p-4">Claimed</th>
                  <th className="text-right p-4">Approved</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-center p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(claim => (
                  <tr key={claim.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-4 text-white">{claim.claim_number}</td>
                    <td className="p-4 text-slate-300">
                      {getClaimTypeIcon(claim.claim_type)} {claim.claim_type}
                    </td>
                    <td className="p-4 text-slate-300">{claim.customer_name}</td>
                    <td className="p-4 text-right text-orange-400">₹{claim.amount_claimed?.toLocaleString()}</td>
                    <td className="p-4 text-right text-green-400">
                      {claim.approved_amount ? `₹${claim.approved_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" variant="ghost" onClick={() => openUpdateModal(claim)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {claims.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No claims found
            </div>
          )}
        </div>
      )}

      {/* Update Modal */}
      {updateModal && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Update Claim: {selectedClaim.claim_number}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm">Status</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="settled">Settled</option>
                </select>
              </div>
              
              <div>
                <label className="text-slate-400 text-sm">Approved Amount (₹)</label>
                <input
                  type="number"
                  value={updateData.approved_amount}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, approved_amount: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter approved amount"
                />
              </div>
              
              <div>
                <label className="text-slate-400 text-sm">Remarks</label>
                <textarea
                  value={updateData.remarks}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  rows="3"
                  placeholder="Add remarks..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setUpdateModal(false)}>Cancel</Button>
              <Button onClick={updateClaim} className="bg-orange-500 hover:bg-orange-600">Update</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InsuranceModule;
