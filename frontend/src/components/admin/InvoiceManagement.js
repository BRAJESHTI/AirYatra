import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Download, Eye, Send, CheckCircle, AlertTriangle,
  Loader2, RefreshCw, IndianRupee, Calendar, User, Building2,
  Printer, Filter, Search, CreditCard, Copy, Trash2, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';
import { ContextMenu } from '@/components/shared/ContextMenu';

function InvoiceManagement() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState({ status: '', invoice_type: '' });

  // Form state for new invoice
  const [newInvoice, setNewInvoice] = useState({
    customer_name: '',
    customer_email: '',
    customer_gstin: '',
    customer_address: '',
    items: [{ description: '', quantity: 1, unit_price: 0, gst_percent: 18 }]
  });

  useEffect(() => {
    loadDashboard();
    loadInvoices();
    loadSettings();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/invoices/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.invoice_type) params.invoice_type = filters.invoice_type;
      
      const response = await api.get('/invoices', { params });
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  };

  const loadRefunds = async () => {
    try {
      const response = await api.get('/invoices/refunds/list');
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Failed to load refunds:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/invoices/settings/config');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const updateInvoiceStatus = async (invoiceId, status) => {
    try {
      await api.put(`/invoices/${invoiceId}/status?status=${status}`);
      toast.success(`Invoice marked as ${status}`);
      loadInvoices();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };

  const addItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, gst_percent: 18 }]
    }));
  };

  const updateItem = (index, field, value) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let tax = 0;
    newInvoice.items.forEach(item => {
      const itemTotal = item.quantity * item.unit_price;
      subtotal += itemTotal;
      tax += itemTotal * (item.gst_percent / 100);
    });
    return { subtotal, tax, total: subtotal + tax };
  };

  const statusColors = {
    draft: 'bg-slate-500',
    sent: 'bg-blue-500',
    paid: 'bg-green-500',
    cancelled: 'bg-red-500',
    overdue: 'bg-orange-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-green-400" />
            Invoice & Billing</h2>
          <p className="text-slate-400 mt-1">GST compliant invoicing and billing management</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateForm(true)} className="bg-green-500 hover:bg-green-600">
            <Plus className="h-4 w-4 mr-2" /> New Invoice
          </Button>
          <Button onClick={() => { loadDashboard(); loadInvoices(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: FileText },
          { id: 'invoices', label: 'All Invoices', icon: FileText },
          { id: 'gst', label: 'GST Reports', icon: Building2 },
          { id: 'refunds', label: 'Refunds', icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'refunds') loadRefunds(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <IndianRupee className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">This Month Revenue</p>
                  <p className="text-white text-xl font-bold">₹{dashboard.this_month_revenue?.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Pending Amount</p>
                  <p className="text-yellow-400 text-xl font-bold">₹{dashboard.pending_amount?.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Calendar className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Overdue</p>
                  <p className="text-red-400 text-xl font-bold">{dashboard.overdue_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Invoices</p>
                  <p className="text-white text-xl font-bold">{dashboard.total_invoices}</p>
                </div>
              </div>
            </div>
          </div>

          {/* GST Summary */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">GST Summary (This Month)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Taxable Amount</p>
                <p className="text-white text-lg font-semibold">₹{dashboard.gst_summary?.total_taxable?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">CGST</p>
                <p className="text-white text-lg font-semibold">₹{dashboard.gst_summary?.cgst?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">SGST</p>
                <p className="text-white text-lg font-semibold">₹{dashboard.gst_summary?.sgst?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">IGST</p>
                <p className="text-white text-lg font-semibold">₹{dashboard.gst_summary?.igst?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filters.status}
              onChange={(e) => { setFilters(f => ({...f, status: e.target.value})); setTimeout(loadInvoices, 100); }}
              className="bg-slate-800 border-slate-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filters.invoice_type}
              onChange={(e) => { setFilters(f => ({...f, invoice_type: e.target.value})); setTimeout(loadInvoices, 100); }}
              className="bg-slate-800 border-slate-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="tax_invoice">Tax Invoice</option>
              <option value="proforma">Proforma</option>
              <option value="credit_note">Credit Note</option>
            </select>
          </div>

          {/* Invoice List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Invoice #</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Date</th>
                  <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Amount</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Status</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {invoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{invoice.invoice_number}</p>
                      <p className="text-slate-500 text-xs">{invoice.invoice_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{invoice.customer_name}</p>
                      {invoice.customer_gstin && (
                        <p className="text-slate-500 text-xs">GSTIN: {invoice.customer_gstin}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-white font-semibold">₹{invoice.grand_total?.toLocaleString()}</p>
                      {invoice.amount_due > 0 && (
                        <p className="text-red-400 text-xs">Due: ₹{invoice.amount_due?.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[invoice.status]}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ContextMenu
                        position="left"
                        actions={[
                          {
                            id: 'view',
                            label: 'View Invoice',
                            icon: Eye,
                            onClick: () => toast.info('Invoice preview coming soon')
                          },
                          {
                            id: 'print',
                            label: 'Print Invoice',
                            icon: Printer,
                            onClick: () => toast.info('Print feature coming soon')
                          },
                          {
                            id: 'download',
                            label: 'Download PDF',
                            icon: Download,
                            onClick: () => toast.info('PDF download coming soon')
                          },
                          {
                            id: 'copy-number',
                            label: 'Copy Invoice #',
                            icon: Copy,
                            onClick: () => {
                              navigator.clipboard.writeText(invoice.invoice_number);
                              toast.success('Invoice number copied!');
                            }
                          },
                          { divider: true },
                          ...(invoice.status === 'draft' ? [{
                            id: 'send',
                            label: 'Mark as Sent',
                            icon: Send,
                            onClick: () => updateInvoiceStatus(invoice.id, 'sent')
                          }] : []),
                          ...(invoice.status === 'sent' ? [{
                            id: 'mark-paid',
                            label: 'Mark as Paid',
                            icon: CheckCircle,
                            success: true,
                            onClick: () => updateInvoiceStatus(invoice.id, 'paid')
                          }] : []),
                          {
                            id: 'email',
                            label: 'Send via Email',
                            icon: Mail,
                            onClick: () => toast.info('Email sending coming soon')
                          },
                          ...(invoice.status === 'draft' ? [
                            { divider: true },
                            {
                              id: 'delete',
                              label: 'Delete Invoice',
                              icon: Trash2,
                              danger: true,
                              onClick: () => toast.warning('Delete invoice feature coming soon')
                            }
                          ] : [])
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {invoices.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GST Reports Tab */}
      {activeTab === 'gst' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">GST Report Generator</h3>
          <p className="text-slate-400 mb-6">Generate GST reports for tax filing (GSTR-1, GSTR-3B)</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-300">Month</Label>
              <select className="w-full bg-slate-900 border-slate-600 text-white rounded p-2 mt-1">
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Year</Label>
              <select className="w-full bg-slate-900 border-slate-600 text-white rounded p-2 mt-1">
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="bg-green-500 hover:bg-green-600">
                <Download className="h-4 w-4 mr-2" /> Generate Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Refunds Tab */}
      {activeTab === 'refunds' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold">Refund Requests</h3>
          </div>
          
          {refunds.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No refund requests</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {refunds.map(refund => (
                <div key={refund.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{refund.refund_number}</p>
                      <p className="text-slate-400 text-sm">Invoice: {refund.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">₹{refund.amount?.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        refund.status === 'processed' ? 'bg-green-500' :
                        refund.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                      } text-white`}>
                        {refund.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-semibold text-lg mb-4">Create New Invoice</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Customer Name *</Label>
                  <Input
                    value={newInvoice.customer_name}
                    onChange={(e) => setNewInvoice(prev => ({...prev, customer_name: e.target.value}))}
                    className="bg-slate-800 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Customer Email</Label>
                  <Input
                    value={newInvoice.customer_email}
                    onChange={(e) => setNewInvoice(prev => ({...prev, customer_email: e.target.value}))}
                    className="bg-slate-800 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">GSTIN (optional)</Label>
                  <Input
                    value={newInvoice.customer_gstin}
                    onChange={(e) => setNewInvoice(prev => ({...prev, customer_gstin: e.target.value}))}
                    className="bg-slate-800 border-slate-600 text-white mt-1"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Address</Label>
                  <Input
                    value={newInvoice.customer_address}
                    onChange={(e) => setNewInvoice(prev => ({...prev, customer_address: e.target.value}))}
                    className="bg-slate-800 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <Label className="text-slate-300">Items</Label>
                <div className="space-y-2 mt-2">
                  {newInvoice.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value))}
                        placeholder="Qty"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                        placeholder="Unit Price"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                      <Input
                        type="number"
                        value={item.gst_percent}
                        onChange={(e) => updateItem(idx, 'gst_percent', parseFloat(e.target.value))}
                        placeholder="GST %"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={addItem} variant="outline" size="sm" className="mt-2">
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {/* Totals */}
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal:</span>
                  <span>₹{calculateTotal().subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>GST:</span>
                  <span>₹{calculateTotal().tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg border-t border-slate-600 pt-2 mt-2">
                  <span>Total:</span>
                  <span>₹{calculateTotal().total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setShowCreateForm(false)} variant="outline">Cancel</Button>
              <Button className="bg-green-500 hover:bg-green-600">Create Invoice</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceManagement;
