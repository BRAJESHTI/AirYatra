import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, FileText, RefreshCw, Download, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function AccountingIntegration() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/accounting/dashboard');
      setDashboard(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const exportReport = async (type) => {
    try {
      const res = await api.get(`/accounting/export/${type}`);
      alert(`${type} report exported!`);
    } catch (error) { alert('Export failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Calculator className="h-6 w-6 mr-2 text-indigo-500" /> Accounting Integration
          </h1>
          <p className="text-slate-400">Financial reports and Tally/QuickBooks sync</p>
        </div>
        <Button onClick={loadDashboard} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
              <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white">₹{((dashboard.total_revenue || 0) / 1000).toFixed(0)}K</p>
              <p className="text-slate-400 text-sm">Total Revenue</p>
            </div>
            <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
              <TrendingDown className="h-5 w-5 text-red-400 mb-2" />
              <p className="text-2xl font-bold text-white">₹{((dashboard.total_expenses || 0) / 1000).toFixed(0)}K</p>
              <p className="text-slate-400 text-sm">Total Expenses</p>
            </div>
            <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
              <DollarSign className="h-5 w-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-white">₹{((dashboard.net_profit || 0) / 1000).toFixed(0)}K</p>
              <p className="text-slate-400 text-sm">Net Profit</p>
            </div>
            <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
              <FileText className="h-5 w-5 text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-white">{dashboard.pending_invoices || 0}</p>
              <p className="text-slate-400 text-sm">Pending Invoices</p>
            </div>
          </div>

          <div className="flex space-x-4 border-b border-slate-700">
            {['overview', 'transactions', 'reports', 'integrations'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">Monthly Summary</h2>
                <div className="space-y-4">
                  {['Revenue', 'Expenses', 'GST Collected', 'TDS Deducted'].map((item, i) => (
                    <div key={item} className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                      <span className="text-slate-300">{item}</span>
                      <span className="text-white font-medium">₹{[150000, 50000, 27000, 15000][i].toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Export</h2>
                <div className="grid grid-cols-2 gap-3">
                  {['P&L Statement', 'Balance Sheet', 'GST Report', 'TDS Report'].map((report, i) => (
                    <Button key={report} onClick={() => exportReport(report.toLowerCase().replace(/ /g, '_'))} variant="outline" className="justify-start">
                      <Download className="h-4 w-4 mr-2" /> {report}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
              <div className="space-y-3">
                {(dashboard.recent_transactions || []).length > 0 ? (
                  dashboard.recent_transactions.map((t, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-900 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{t.description}</p>
                        <p className="text-slate-400 text-sm">{t.date}</p>
                      </div>
                      <span className={t.type === 'credit' ? 'text-green-400' : 'text-red-400'}>
                        {t.type === 'credit' ? '+' : '-'}₹{t.amount?.toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400">No recent transactions</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="grid grid-cols-2 gap-6">
              {['Tally Prime', 'QuickBooks', 'Zoho Books', 'Busy Accounting'].map((software, i) => (
                <div key={software} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-semibold">{software}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${i === 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                      {i === 0 ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">Sync invoices and transactions automatically</p>
                  <Button variant="outline" className="w-full">
                    {i === 0 ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Generate Reports</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-sm">From Date</label>
                  <Input type="date" className="bg-slate-700 mt-1" />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">To Date</label>
                  <Input type="date" className="bg-slate-700 mt-1" />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Report Type</label>
                  <select className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 text-white mt-1">
                    <option>Profit & Loss</option>
                    <option>Balance Sheet</option>
                    <option>Cash Flow</option>
                    <option>GST Summary</option>
                  </select>
                </div>
              </div>
              <Button className="mt-4 bg-orange-500"><Download className="h-4 w-4 mr-2" /> Generate Report</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AccountingIntegration;
