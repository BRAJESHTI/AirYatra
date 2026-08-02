import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Clock, CheckCircle, FileText, User, Plane, Briefcase,
  RefreshCw, Bell, Calendar, ChevronRight, Filter, Download, Mail,
  Shield, Search, ExternalLink, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Category config
const categoryConfig = {
  pilot: { icon: User, color: 'purple', label: 'Pilot / पायलट', bgColor: 'from-purple-900/30' },
  aircraft: { icon: Plane, color: 'cyan', label: 'Aircraft / विमान', bgColor: 'from-cyan-900/30' },
  employee: { icon: Briefcase, color: 'green', label: 'Employee / कर्मचारी', bgColor: 'from-green-900/30' }
};

function DocumentExpiryDashboard() {
  const [loading, setLoading] = useState(true);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [expiredDocs, setExpiredDocs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingAlert, setSendingAlert] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    expired: 0,
    expiring7: 0,
    expiring30: 0,
    expiring90: 0
  });

  useEffect(() => {
    loadExpiryData();
  }, []);

  const loadExpiryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Load all expiring documents
      const [pilotRes, aircraftRes, employeeRes] = await Promise.all([
        fetch(`${API_URL}/api/maintenance/pilot-documents/expiring?days=90`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ json: () => ({ documents: [] }) })),
        fetch(`${API_URL}/api/maintenance/aircraft-documents/expiring?days=90`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ json: () => ({ documents: [] }) })),
        fetch(`${API_URL}/api/hr/employee-documents/expiring?days=90`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ json: () => ({ documents: [] }) }))
      ]);

      const pilotDocs = (await pilotRes.json?.())?.documents || [];
      const aircraftDocs = (await aircraftRes.json?.())?.documents || [];
      const employeeDocs = (await employeeRes.json?.())?.documents || [];

      // Combine and categorize
      const allDocs = [
        ...pilotDocs.map(d => ({ ...d, category: 'pilot', owner_name: d.pilot_name })),
        ...aircraftDocs.map(d => ({ ...d, category: 'aircraft', owner_name: d.aircraft_registration })),
        ...employeeDocs.map(d => ({ ...d, category: 'employee', owner_name: d.employee_name }))
      ];

      // Calculate days until expiry
      const today = new Date();
      const processedDocs = allDocs.map(doc => {
        if (!doc.expiry_date) return { ...doc, daysLeft: null };
        const expiry = new Date(doc.expiry_date);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return { ...doc, daysLeft };
      }).filter(d => d.daysLeft !== null);

      // Separate expired vs expiring
      const expired = processedDocs.filter(d => d.daysLeft < 0).sort((a, b) => a.daysLeft - b.daysLeft);
      const expiring = processedDocs.filter(d => d.daysLeft >= 0 && d.daysLeft <= 90).sort((a, b) => a.daysLeft - b.daysLeft);

      setExpiredDocs(expired);
      setExpiringDocs(expiring);

      // Calculate stats
      setStats({
        total: processedDocs.length,
        expired: expired.length,
        expiring7: expiring.filter(d => d.daysLeft <= 7).length,
        expiring30: expiring.filter(d => d.daysLeft <= 30).length,
        expiring90: expiring.length
      });

    } catch (error) {
      console.error('Failed to load expiry data:', error);
      toast.error('Failed to load document expiry data');
    } finally {
      setLoading(false);
    }
  };

  const sendExpiryAlert = async (doc) => {
    setSendingAlert(doc.id);
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let body = {};

      switch (doc.category) {
        case 'pilot':
          endpoint = '/api/maintenance/pilot-documents/send-alert';
          body = { pilot_id: doc.pilot_id, document_id: doc.id };
          break;
        case 'aircraft':
          endpoint = '/api/maintenance/aircraft-documents/send-alert';
          body = { aircraft_id: doc.aircraft_id, document_id: doc.id };
          break;
        case 'employee':
          endpoint = '/api/hr/employee-documents/send-alert';
          body = { employee_id: doc.employee_id, document_id: doc.id };
          break;
        default:
          throw new Error('Unknown category');
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Failed to send alert');

      toast.success('Alert sent successfully!');
    } catch (error) {
      toast.error('Failed to send alert');
    } finally {
      setSendingAlert(null);
    }
  };

  const exportToCSV = () => {
    const allDocs = [...expiredDocs, ...expiringDocs];
    const headers = ['Category', 'Owner', 'Document Type', 'Document Number', 'Expiry Date', 'Days Left', 'Status'];
    const rows = allDocs.map(doc => [
      doc.category,
      doc.owner_name || '-',
      doc.document_type || '-',
      doc.document_number || '-',
      doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '-',
      doc.daysLeft,
      doc.daysLeft < 0 ? 'EXPIRED' : doc.daysLeft <= 7 ? 'CRITICAL' : doc.daysLeft <= 30 ? 'WARNING' : 'EXPIRING'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_expiry_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported!');
  };

  const filteredExpired = expiredDocs.filter(d => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (searchTerm && !d.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !d.document_type?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredExpiring = expiringDocs.filter(d => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false;
    if (searchTerm && !d.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !d.document_type?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (daysLeft) => {
    if (daysLeft < 0) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium animate-pulse">EXPIRED</span>;
    }
    if (daysLeft <= 7) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">CRITICAL ({daysLeft}d)</span>;
    }
    if (daysLeft <= 30) {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">WARNING ({daysLeft}d)</span>;
    }
    return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">{daysLeft}d left</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            Document Expiry Dashboard / दस्तावेज़ समाप्ति डैशबोर्ड
          </h2>
          <p className="text-slate-400 mt-1">Track expiring documents across pilots, aircraft, and employees</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="border-slate-600">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={loadExpiryData} variant="outline" className="border-slate-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-red-900/40 to-slate-900 rounded-xl p-4 border border-red-700/30">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">Expired</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{stats.expired}</p>
          <p className="text-xs text-slate-500">Need immediate action</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-slate-900 rounded-xl p-4 border border-red-600/30">
          <div className="flex items-center gap-2 text-red-300 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">7 Days</span>
          </div>
          <p className="text-3xl font-bold text-red-300">{stats.expiring7}</p>
          <p className="text-xs text-slate-500">Critical</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-slate-900 rounded-xl p-4 border border-yellow-700/30">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">30 Days</span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{stats.expiring30}</p>
          <p className="text-xs text-slate-500">Warning</p>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-xl p-4 border border-orange-700/30">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Calendar className="h-5 w-5" />
            <span className="text-sm font-medium">90 Days</span>
          </div>
          <p className="text-3xl font-bold text-orange-400">{stats.expiring90}</p>
          <p className="text-xs text-slate-500">Expiring soon</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <FileText className="h-5 w-5" />
            <span className="text-sm font-medium">Total Tracked</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-slate-500">With expiry dates</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or document type..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {Object.entries(categoryConfig).map(([cat, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                  selectedCategory === cat ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" /> {config.label.split('/')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Expired Documents Section */}
          {filteredExpired.length > 0 && (
            <div className="bg-red-950/20 rounded-xl border border-red-700/30 overflow-hidden">
              <div className="bg-red-900/30 px-4 py-3 border-b border-red-700/30">
                <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Expired Documents ({filteredExpired.length})
                </h3>
              </div>
              <div className="divide-y divide-red-700/20">
                {filteredExpired.map(doc => {
                  const config = categoryConfig[doc.category] || categoryConfig.pilot;
                  const Icon = config.icon;
                  return (
                    <div key={doc.id} className="p-4 hover:bg-red-900/10 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-500/20`}>
                          <Icon className={`h-5 w-5 text-${config.color}-400`} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{doc.owner_name || 'Unknown'}</p>
                          <p className="text-slate-400 text-sm">
                            {doc.document_type?.replace(/_/g, ' ')} • {doc.document_number || 'No number'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-red-400 text-sm">
                            Expired: {new Date(doc.expiry_date).toLocaleDateString('en-IN')}
                          </p>
                          {getStatusBadge(doc.daysLeft)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendExpiryAlert(doc)}
                          disabled={sendingAlert === doc.id}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {sendingAlert === doc.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Bell className="h-4 w-4 mr-1" /> Alert</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expiring Documents Section */}
          {filteredExpiring.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-400" />
                  Expiring Soon ({filteredExpiring.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {filteredExpiring.map(doc => {
                  const config = categoryConfig[doc.category] || categoryConfig.pilot;
                  const Icon = config.icon;
                  return (
                    <div key={doc.id} className={`p-4 hover:bg-slate-700/30 transition-colors flex items-center justify-between ${
                      doc.daysLeft <= 7 ? 'bg-red-900/10' : doc.daysLeft <= 30 ? 'bg-yellow-900/10' : ''
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-500/20`}>
                          <Icon className={`h-5 w-5 text-${config.color}-400`} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{doc.owner_name || 'Unknown'}</p>
                          <p className="text-slate-400 text-sm">
                            {doc.document_type?.replace(/_/g, ' ')} • {doc.document_number || 'No number'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-slate-400 text-sm">
                            Expires: {new Date(doc.expiry_date).toLocaleDateString('en-IN')}
                          </p>
                          {getStatusBadge(doc.daysLeft)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendExpiryAlert(doc)}
                          disabled={sendingAlert === doc.id}
                          className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                        >
                          {sendingAlert === doc.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Bell className="h-4 w-4 mr-1" /> Remind</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredExpired.length === 0 && filteredExpiring.length === 0 && (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">All Documents Valid!</p>
              <p className="text-slate-400 mt-2">No documents expiring in the next 90 days</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentExpiryDashboard;
