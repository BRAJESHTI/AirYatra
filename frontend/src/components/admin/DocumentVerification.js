import React, { useState, useEffect } from 'react';
import { FileCheck, AlertTriangle, Clock, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function DocumentVerification() {
  const [dashboard, setDashboard] = useState(null);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState({ status: 'verified', notes: '' });
  const [docTypes, setDocTypes] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, pendingRes, expiringRes, typesRes] = await Promise.all([
        api.get('/api/document-verify/dashboard'),
        api.get('/api/document-verify/pending'),
        api.get('/api/document-verify/expiring?days=30'),
        api.get('/api/document-verify/types')
      ]);
      setDashboard(dashRes.data);
      setPendingDocs(pendingRes.data.pending_documents || []);
      setExpiringDocs(expiringRes.data.expiring_documents || []);
      setDocTypes(typesRes.data.document_types || {});
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyDocument = async () => {
    try {
      await api.post(`/api/document-verify/verify/${selectedDoc.id}`, verifyData);
      setVerifyModal(false);
      loadData();
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-500/20 text-green-400';
      case 'pending': case 'pending_review': return 'bg-yellow-500/20 text-yellow-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Verification</h1>
          <p className="text-slate-400">DGCA license & certificate verification</p>
        </div>
        <Button onClick={loadData} variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <FileCheck className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.total_documents}</p>
            <p className="text-slate-400 text-sm">Total</p>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
            <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.verified}</p>
            <p className="text-slate-400 text-sm">Verified</p>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
            <Clock className="h-5 w-5 text-yellow-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.pending}</p>
            <p className="text-slate-400 text-sm">Pending</p>
          </div>
          <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
            <XCircle className="h-5 w-5 text-red-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.rejected}</p>
            <p className="text-slate-400 text-sm">Rejected</p>
          </div>
          <div className="bg-orange-500/20 rounded-lg p-4 border border-orange-500/50">
            <AlertTriangle className="h-5 w-5 text-orange-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.expiring_within_30_days}</p>
            <p className="text-slate-400 text-sm">Expiring</p>
          </div>
        </div>
      )}

      <div className="flex space-x-4 border-b border-slate-700">
        {['dashboard', 'pending', 'expiring'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingDocs.map(doc => (
            <div key={doc.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between">
                <div>
                  <p className="text-white font-medium">{doc.document_type_name}</p>
                  <p className="text-slate-400 text-sm">#{doc.document_number} - {doc.holder_name}</p>
                </div>
                <Button size="sm" onClick={() => { setSelectedDoc(doc); setVerifyModal(true); }}>Verify</Button>
              </div>
            </div>
          ))}
          {pendingDocs.length === 0 && <p className="text-center text-slate-400 py-8">No pending documents</p>}
        </div>
      )}

      {activeTab === 'expiring' && (
        <div className="space-y-3">
          {expiringDocs.map(doc => (
            <div key={doc.id} className="bg-slate-800 rounded-lg p-4 border border-orange-500/50">
              <div className="flex justify-between">
                <div>
                  <p className="text-white font-medium">{doc.document_type_name}</p>
                  <p className="text-slate-400 text-sm">#{doc.document_number}</p>
                </div>
                <span className="text-orange-400">{doc.expiry_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'dashboard' && dashboard && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Verification Rate: {dashboard.verification_rate}%</h2>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${dashboard.verification_rate}%` }} />
          </div>
        </div>
      )}

      {verifyModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Verify Document</h3>
            <div className="mb-4 p-3 bg-slate-900 rounded">
              <p className="text-white">{selectedDoc.document_type_name}</p>
              <p className="text-slate-400 text-sm">#{selectedDoc.document_number}</p>
            </div>
            <div className="space-y-4">
              <select value={verifyData.status} onChange={(e) => setVerifyData(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <textarea value={verifyData.notes} onChange={(e) => setVerifyData(p => ({ ...p, notes: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows="3" placeholder="Notes..." />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setVerifyModal(false)}>Cancel</Button>
              <Button onClick={verifyDocument} className={verifyData.status === 'verified' ? 'bg-green-600' : 'bg-red-600'}>
                {verifyData.status === 'verified' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentVerification;
