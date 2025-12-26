import React, { useState, useEffect } from 'react';
import { Cloud, Users, FileText, RefreshCw, Settings, Link, UserPlus, Receipt, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { integrationsAPI } from '@/services/api';

export default function ZohoIntegration() {
  const [dashboard, setDashboard] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts');
  const [configForm, setConfigForm] = useState({
    client_id: '',
    client_secret: '',
    refresh_token: '',
    organization_id: '',
    portal_name: '',
    modules_enabled: ['books', 'crm']
  });
  const [contacts, setContacts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, configRes, contactsRes, invoicesRes, leadsRes] = await Promise.all([
        integrationsAPI.getZohoDashboard(),
        integrationsAPI.getZohoConfig(),
        integrationsAPI.getZohoContacts(),
        integrationsAPI.getZohoInvoices(),
        integrationsAPI.getZohoLeads()
      ]);
      setDashboard(dashRes.data);
      setConfig(configRes.data);
      setContacts(contactsRes.data.contacts || []);
      setInvoices(invoicesRes.data.invoices || []);
      setLeads(leadsRes.data.leads || []);
    } catch (error) {
      console.error('Failed to load Zoho data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await integrationsAPI.updateZohoConfig(configForm);
      setShowConfig(false);
      loadData();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const triggerSync = async (module = 'all') => {
    setSyncing(true);
    try {
      const res = await integrationsAPI.triggerZohoSync(module);
      alert(`Synced successfully: ${JSON.stringify(res.data.records_synced)}`);
      loadData();
    } catch (error) {
      alert('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const autoSyncBookings = async () => {
    setSyncing(true);
    try {
      const res = await integrationsAPI.autoSyncBookingsToZoho();
      alert(`Synced ${res.data.synced_count} bookings to Zoho`);
      loadData();
    } catch (error) {
      alert('Auto-sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-white">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Zoho Integration / ज़ोहो इंटीग्रेशन</h2>
          <p className="text-slate-400">CRM & Books Sync with Zoho</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoSyncBookings} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Auto-Sync Bookings
          </Button>
          <Button variant="outline" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.contacts_synced || 0}</p>
                <p className="text-slate-400 text-sm">Contacts / संपर्क</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Receipt className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.invoices_synced || 0}</p>
                <p className="text-slate-400 text-sm">Invoices / चालान</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.leads_synced || 0}</p>
                <p className="text-slate-400 text-sm">CRM Leads / लीड्स</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Cloud className="h-6 w-6 text-orange-400" />
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
              <Settings className="h-5 w-5 mr-2" /> Zoho Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Client ID</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Your Zoho Client ID"
                  value={configForm.client_id}
                  onChange={(e) => setConfigForm({...configForm, client_id: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Client Secret</Label>
                <Input
                  type="password"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Your Client Secret"
                  value={configForm.client_secret}
                  onChange={(e) => setConfigForm({...configForm, client_secret: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Organization ID</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Zoho Organization ID"
                  value={configForm.organization_id}
                  onChange={(e) => setConfigForm({...configForm, organization_id: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Portal Name</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Your Portal Name"
                  value={configForm.portal_name}
                  onChange={(e) => setConfigForm({...configForm, portal_name: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Refresh Token</Label>
              <Input
                type="password"
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="OAuth Refresh Token"
                value={configForm.refresh_token}
                onChange={(e) => setConfigForm({...configForm, refresh_token: e.target.value})}
              />
            </div>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={configForm.modules_enabled.includes('books')}
                  onChange={(e) => {
                    const modules = e.target.checked 
                      ? [...configForm.modules_enabled, 'books']
                      : configForm.modules_enabled.filter(m => m !== 'books');
                    setConfigForm({...configForm, modules_enabled: modules});
                  }}
                  className="rounded border-slate-600"
                />
                <span className="text-slate-300">Zoho Books</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={configForm.modules_enabled.includes('crm')}
                  onChange={(e) => {
                    const modules = e.target.checked 
                      ? [...configForm.modules_enabled, 'crm']
                      : configForm.modules_enabled.filter(m => m !== 'crm');
                    setConfigForm({...configForm, modules_enabled: modules});
                  }}
                  className="rounded border-slate-600"
                />
                <span className="text-slate-300">Zoho CRM</span>
              </label>
            </div>
            <Button onClick={saveConfig} className="bg-orange-500 hover:bg-orange-600">
              Save Configuration
            </Button>
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
            <Button onClick={() => triggerSync('books')} disabled={syncing} variant="outline">
              Sync Books
            </Button>
            <Button onClick={() => triggerSync('crm')} disabled={syncing} variant="outline">
              Sync CRM
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-700">
        {[{id: 'contacts', label: 'Contacts / संपर्क', icon: Users},
          {id: 'invoices', label: 'Invoices / चालान', icon: Receipt},
          {id: 'leads', label: 'CRM Leads / लीड्स', icon: TrendingUp}].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          {activeTab === 'contacts' && (
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No contacts synced yet</p>
              ) : (
                contacts.map((contact, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-blue-500/20">
                        <Users className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{contact.contact_name}</p>
                        <p className="text-slate-400 text-sm">{contact.email} • {contact.phone}</p>
                      </div>
                    </div>
                    <span className="text-slate-400 text-sm">{contact.contact_type}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No invoices synced yet</p>
              ) : (
                invoices.map((invoice, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-green-500/20">
                        <Receipt className="h-4 w-4 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{invoice.zoho_invoice_id}</p>
                        <p className="text-slate-400 text-sm">₹{invoice.total?.toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No leads synced yet</p>
              ) : (
                leads.map((lead, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-purple-500/20">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{lead.first_name} {lead.last_name}</p>
                        <p className="text-slate-400 text-sm">{lead.company} • {lead.lead_source}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      lead.lead_status === 'Converted' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {lead.lead_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-center text-slate-500 text-sm">
        {dashboard?.is_configured ? (
          <span className="text-green-400">✓ Zoho Connected - Modules: {dashboard?.modules_enabled?.join(', ')}</span>
        ) : (
          <span className="text-yellow-400">⚠ Demo Mode - Configure Zoho OAuth to enable live sync</span>
        )}
      </div>
    </div>
  );
}
