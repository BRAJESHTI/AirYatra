import React, { useState } from 'react';
import { 
  FileText, Download, RefreshCw, Plus, Printer, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

export default function PDFInvoiceExport() {
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  const [invoiceData, setInvoiceData] = useState({
    booking_id: '',
    customer_name: '',
    customer_address: '',
    customer_gst: '',
    items: [{ description: '', hsn_code: '996311', quantity: 1, rate: 0, amount: 0 }],
    notes: ''
  });

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { description: '', hsn_code: '996311', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...invoiceData.items];
    newItems[index][field] = value;
    
    // Auto-calculate amount
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = (parseFloat(newItems[index].quantity) || 0) * (parseFloat(newItems[index].rate) || 0);
    }
    
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const removeItem = (index) => {
    if (invoiceData.items.length > 1) {
      const newItems = invoiceData.items.filter((_, i) => i !== index);
      setInvoiceData({ ...invoiceData, items: newItems });
    }
  };

  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const gstRate = 18;
    const gstAmount = subtotal * (gstRate / 100);
    const total = subtotal + gstAmount;
    return { subtotal, gstRate, gstAmount, total };
  };

  const handleGenerateInvoice = async () => {
    const { subtotal, gstRate, gstAmount, total } = calculateTotals();
    
    if (!invoiceData.customer_name || !invoiceData.customer_address || subtotal === 0) {
      toast.error('Please fill required fields and add at least one item');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/finance/phase5/invoice/generate', {
        ...invoiceData,
        subtotal,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total
      }, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice generated and downloaded');
      setShowGenerateModal(false);
    } catch (error) {
      toast.error('Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, gstRate, gstAmount, total } = calculateTotals();

  return (
    <div className="space-y-6" data-testid="pdf-invoice-export">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-amber-400" />
            PDF Invoice Export / पीडीएफ इनवॉइस
          </h1>
          <p className="text-slate-400 mt-1">Generate professional GST-compliant invoices with company letterhead</p>
        </div>
        <Button 
          onClick={() => setShowGenerateModal(true)}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      {/* Invoice Preview Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-400" />
            Invoice Preview / इनवॉइस पूर्वावलोकन
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg p-8 text-gray-900">
            {/* Company Header */}
            <div className="text-center border-b pb-4 mb-4">
              <h2 className="text-2xl font-bold text-blue-900">✈️ AirYatra</h2>
              <p className="text-sm text-gray-500">India&apos;s Premium Helicopter Booking Platform</p>
              <p className="text-xs text-gray-400 mt-1">
                GSTIN: 27AABCU9603R1ZM | CIN: U62200MH2024PTC123456
              </p>
            </div>
            
            {/* Invoice Title */}
            <div className="bg-blue-900 text-white text-center py-2 mb-4 rounded">
              <h3 className="text-lg font-semibold">TAX INVOICE</h3>
            </div>
            
            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p><strong>Invoice Number:</strong> AY-INV-XXXXXXXX</p>
                <p><strong>Booking ID:</strong> {invoiceData.booking_id || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                <p><strong>Due Date:</strong> {new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
            
            {/* Bill To */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">BILL TO:</h4>
              <p className="font-medium">{invoiceData.customer_name || 'Customer Name'}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {invoiceData.customer_address || 'Customer Address'}
              </p>
              {invoiceData.customer_gst && (
                <p className="text-sm">GSTIN: {invoiceData.customer_gst}</p>
              )}
            </div>
            
            {/* Items Table */}
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="p-2 text-left">S.No</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-center">HSN</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Rate (₹)</th>
                  <th className="p-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2">{item.description || 'Item description'}</td>
                    <td className="p-2 text-center">{item.hsn_code}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatINR(item.rate)}</td>
                    <td className="p-2 text-right">{formatINR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-1">
                  <span>Subtotal:</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>CGST ({gstRate/2}%):</span>
                  <span>{formatINR(gstAmount/2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>SGST ({gstRate/2}%):</span>
                  <span>{formatINR(gstAmount/2)}</span>
                </div>
                <div className="flex justify-between py-2 border-t font-bold text-blue-900 bg-blue-50">
                  <span>Grand Total:</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500">
              <p>This is a computer-generated invoice. No signature required.</p>
              <p className="text-blue-900 mt-1">Thank you for flying with AirYatra! ✈️</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Invoice Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              Generate Invoice / इनवॉइस बनाएं
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Customer Name *</label>
                <Input
                  value={invoiceData.customer_name}
                  onChange={(e) => setInvoiceData({...invoiceData, customer_name: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Tata Sons Ltd"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Booking ID</label>
                <Input
                  value={invoiceData.booking_id}
                  onChange={(e) => setInvoiceData({...invoiceData, booking_id: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Customer Address *</label>
              <textarea
                value={invoiceData.customer_address}
                onChange={(e) => setInvoiceData({...invoiceData, customer_address: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white"
                rows={2}
                placeholder="Full billing address"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Customer GSTIN</label>
              <Input
                value={invoiceData.customer_gst}
                onChange={(e) => setInvoiceData({...invoiceData, customer_gst: e.target.value.toUpperCase()})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., 27AABCT1234A1ZM"
              />
            </div>
            
            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Line Items *</label>
                <Button variant="outline" size="sm" onClick={addItem} className="border-slate-600">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {invoiceData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="col-span-5 bg-slate-800 border-slate-700 text-white text-sm"
                      placeholder="Description"
                    />
                    <Input
                      value={item.hsn_code}
                      onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)}
                      className="col-span-2 bg-slate-800 border-slate-700 text-white text-sm"
                      placeholder="HSN"
                    />
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      className="col-span-1 bg-slate-800 border-slate-700 text-white text-sm"
                      placeholder="Qty"
                    />
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                      className="col-span-2 bg-slate-800 border-slate-700 text-white text-sm"
                      placeholder="Rate"
                    />
                    <div className="col-span-1 text-white text-sm text-right">
                      {formatINR(item.amount)}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeItem(idx)}
                      className="col-span-1 text-red-400 hover:text-red-300"
                      disabled={invoiceData.items.length === 1}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Totals Preview */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Subtotal:</span>
                <span className="text-white">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>GST (18%):</span>
                <span className="text-white">{formatINR(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-lg border-t border-slate-700 pt-2 mt-2">
                <span>Total:</span>
                <span className="text-amber-400">{formatINR(total)}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Notes</label>
              <Input
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Optional notes for the invoice"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateInvoice}
              disabled={loading || !invoiceData.customer_name || !invoiceData.customer_address || subtotal === 0}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Generate & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
