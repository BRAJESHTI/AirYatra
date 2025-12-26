import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, FileText, Upload, Download, Settings, CheckCircle, XCircle, Clock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { integrationsAPI } from '@/services/api';

export default function TallyIntegration() {
  const [dashboard, setDashboard] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configForm, setConfigForm] = useState({
    company_name: '',
    server_url: 'http://localhost:9000',
    username: '',
    password: '',
    auto_sync: false,
    sync_frequency: 'daily',
    sync_invoices: true,
    sync_payments: true,
    sync_ledgers: true
  });
  const [vouchers, setVouchers] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, configRes, vouchersRes, logsRes] = await Promise.all([
        integrationsAPI.getTallyDashboard(),
        integrationsAPI.getTallyConfig(),
        integrationsAPI.getTallyVouchers(),
        integrationsAPI.getTallySyncLogs()
      ]);
      setDashboard(dashRes.data);
      setConfig(configRes.data);
      setVouchers(vouchersRes.data.vouchers || []);
      setSyncLogs(logsRes.data.logs || []);
    } catch (error) {
      console.error('Failed to load Tally data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await integrationsAPI.updateTallyConfig(configForm);
      setShowConfig(false);
      loadData();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const testConnection = async () => {
    try {
      const res = await integrationsAPI.testTallyConnection();
      alert(res.data.message);
    } catch (error) {
      alert('Connection failed: ' + error.message);
    }
  };

  const triggerSync = async (type = 'all') => {
    setSyncing(true);
    try {
      const res = await integrationsAPI.triggerTallySync(type);
      alert(`Synced ${res.data.vouchers_synced} vouchers`);
      loadData();
    } catch (error) {
      alert('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const exportXML = async () => {
    try {
      const res = await integrationsAPI.exportTallyXML();
      // Download XML
      const blob = new Blob([res.data.xml_content], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tally_export.xml';
      a.click();
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-white">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Tally Integration / टैली इंटीग्रेशन</h2>
          <p className="text-slate-400">Accounting & Voucher Sync with Tally Prime</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportXML}>
            <Download className="h-4 w-4 mr-2" /> Export XML
          </Button>
          <Button variant="outline" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-4 w-4 mr-2" /> Configure
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${dashboard?.is_configured ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                {dashboard?.is_configured ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-yellow-400" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{dashboard?.connection_status || 'Not Configured'}</p>
                <p className="text-slate-400 text-sm">Connection Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.pending_vouchers || 0}</p>
                <p className="text-slate-400 text-sm">Pending Vouchers / बाकी वाउचर</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <ArrowUpRight className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.synced_today || 0}</p>
                <p className="text-slate-400 text-sm">Synced Today / आज सिंक</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {dashboard?.stats?.last_sync ? new Date(dashboard.stats.last_sync).toLocaleString() : 'Never'}
                </p>
                <p className="text-slate-400 text-sm">Last Sync / आखिरी सिंक</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="h-5 w-5 mr-2" /> Tally Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Company Name</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Your Tally Company"
                  value={configForm.company_name}
                  onChange={(e) => setConfigForm({...configForm, company_name: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Server URL</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="http://localhost:9000"
                  value={configForm.server_url}
                  onChange={(e) => setConfigForm({...configForm, server_url: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Username (Optional)</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  value={configForm.username}
                  onChange={(e) => setConfigForm({...configForm, username: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Password (Optional)</Label>
                <Input
                  type="password"
                  className="bg-slate-700 border-slate-600 text-white"
                  value={configForm.password}
                  onChange={(e) => setConfigForm({...configForm, password: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Sync Frequency</Label>
                <select
                  className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                  value={configForm.sync_frequency}
                  onChange={(e) => setConfigForm({...configForm, sync_frequency: e.target.value})}
                >
                  <option value="realtime">Real-time</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={configForm.sync_invoices}
                  onChange={(e) => setConfigForm({...configForm, sync_invoices: e.target.checked})}
                  className="rounded border-slate-600"
                />
                <span className="text-slate-300">Sync Invoices</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={configForm.sync_payments}
                  onChange={(e) => setConfigForm({...configForm, sync_payments: e.target.checked})}
                  className="rounded border-slate-600"
                />
                <span className="text-slate-300">Sync Payments</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={configForm.auto_sync}
                  onChange={(e) => setConfigForm({...configForm, auto_sync: e.target.checked})}
                  className="rounded border-slate-600"
                />
                <span className="text-slate-300">Auto Sync</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveConfig} className="bg-orange-500 hover:bg-orange-600">
                Save Configuration
              </Button>
              <Button variant="outline" onClick={testConnection}>
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Actions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Sync Actions / सिंक एक्शन</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={() => triggerSync('all')} 
              disabled={syncing}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync All
            </Button>
            <Button onClick={() => triggerSync('invoices')} disabled={syncing} variant="outline">
              Sync Invoices
            </Button>
            <Button onClick={() => triggerSync('payments')} disabled={syncing} variant="outline">
              Sync Payments
            </Button>
            <Button onClick={() => triggerSync('ledgers')} disabled={syncing} variant="outline">
              Sync Ledgers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Vouchers */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Vouchers / हाल के वाउचर</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {vouchers.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No vouchers in queue</p>
            ) : (
              vouchers.slice(0, 10).map((voucher, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${voucher.status === 'synced' ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                      <FileText className={`h-4 w-4 ${voucher.status === 'synced' ? 'text-green-400' : 'text-yellow-400'}`} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{voucher.voucher_type} - {voucher.party_name}</p>
                      <p className="text-slate-400 text-sm">₹{voucher.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${voucher.status === 'synced' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {voucher.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Sync History / सिंक हिस्ट्री</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {syncLogs.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No sync history</p>
            ) : (
              syncLogs.slice(0, 5).map((log, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="text-white">{log.sync_type} sync</p>
                    <p className="text-slate-400 text-sm">{new Date(log.created_at || log.started_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${log.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {log.status}
                    </span>
                    {log.vouchers_synced !== undefined && (
                      <p className="text-slate-400 text-sm mt-1">{log.vouchers_synced} vouchers</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-center text-slate-500 text-sm">
        {dashboard?.is_configured ? (
          <span className="text-green-400">✓ Tally Connected - {dashboard?.company_name}</span>
        ) : (
          <span className="text-yellow-400">⚠ Demo Mode - Configure Tally Gateway to enable live sync</span>
        )}
      </div>
    </div>
  );
}
