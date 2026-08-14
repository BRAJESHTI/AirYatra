import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const ITCManagement = () => {
  const [itcSummary, setItcSummary] = useState(null);
  const [itcDetails, setItcDetails] = useState({ input: [], output: [] });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, detailsRes] = await Promise.all([
        api.get(`/gst/itc/summary?month=${selectedMonth}&year=${selectedYear}`),
        api.get(`/gst/itc/details?month=${selectedMonth}&year=${selectedYear}&type=all`)
      ]);
      setItcSummary(summaryRes.data);
      setItcDetails(detailsRes.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">Input/Output Tax Credit</h3>
          <p className="text-slate-400">ITC Management</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {months.map(m => (
                <SelectItem key={m.value} value={String(m.value)} className="text-white">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)} className="text-white">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {itcSummary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-emerald-500/20 border-emerald-500/30">
              <CardContent className="pt-6">
                <TrendingUp className="h-6 w-6 text-emerald-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{itcSummary.output_tax?.total?.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">Output Tax (Sales)</p>
                <p className="text-emerald-400 text-xs">{itcSummary.output_tax?.invoice_count} invoices</p>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/20 border-blue-500/30">
              <CardContent className="pt-6">
                <TrendingDown className="h-6 w-6 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{itcSummary.input_tax?.total?.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">Input Tax (ITC)</p>
                <p className="text-blue-400 text-xs">{itcSummary.input_tax?.bill_count} bills</p>
              </CardContent>
            </Card>
            
            <Card className="bg-yellow-500/20 border-yellow-500/30">
              <CardContent className="pt-6">
                <BarChart3 className="h-6 w-6 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{itcSummary.net_liability?.total_payable?.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">Net Payable</p>
                {itcSummary.net_liability?.itc_carryforward > 0 && (
                  <p className="text-green-400 text-xs">Carry Forward: ₹{itcSummary.net_liability.itc_carryforward.toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-purple-500/20 border-purple-500/30">
              <CardContent className="pt-6">
                <CheckCircle className="h-6 w-6 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{itcSummary.input_tax?.eligible_itc?.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">Eligible ITC</p>
                {itcSummary.input_tax?.ineligible_itc > 0 && (
                  <p className="text-red-400 text-xs">Ineligible: ₹{itcSummary.input_tax.ineligible_itc.toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ITC Flow Visualization */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">ITC Flow / ITC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-8 items-center">
                {/* Output */}
                <div className="text-center">
                  <div className="bg-emerald-500/20 rounded-lg p-4 mb-3">
                    <p className="text-slate-400 text-sm">Output Tax</p>
                    <p className="text-emerald-400 text-2xl font-bold">₹{itcSummary.output_tax?.total?.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">CGST:</span>
                        <span className="text-white">₹{itcSummary.output_tax?.cgst?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">SGST:</span>
                        <span className="text-white">₹{itcSummary.output_tax?.sgst?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IGST:</span>
                        <span className="text-white">₹{itcSummary.output_tax?.igst?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-center">
                  <ArrowRight className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-slate-500 text-sm mt-2">Utilize ITC</p>
                </div>

                {/* Input */}
                <div className="text-center">
                  <div className="bg-blue-500/20 rounded-lg p-4 mb-3">
                    <p className="text-slate-400 text-sm">Input Tax (ITC)</p>
                    <p className="text-blue-400 text-2xl font-bold">₹{itcSummary.input_tax?.total?.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">CGST:</span>
                        <span className="text-white">₹{itcSummary.input_tax?.cgst?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">SGST:</span>
                        <span className="text-white">₹{itcSummary.input_tax?.sgst?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IGST:</span>
                        <span className="text-white">₹{itcSummary.input_tax?.igst?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Result */}
              <div className="mt-6 bg-slate-800 rounded-lg p-4">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-slate-400 text-sm">CGST Payable</p>
                    <p className="text-yellow-400 font-semibold">₹{itcSummary.net_liability?.cgst?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">SGST Payable</p>
                    <p className="text-yellow-400 font-semibold">₹{itcSummary.net_liability?.sgst?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">IGST Payable</p>
                    <p className="text-yellow-400 font-semibold">₹{itcSummary.net_liability?.igst?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Payable</p>
                    <p className="text-red-400 font-bold text-lg">₹{itcSummary.net_liability?.total_payable?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Tables */}
          <Tabs defaultValue="input" className="space-y-4">
            <TabsList className="bg-slate-800">
              <TabsTrigger value="input" className="data-[state=active]:bg-blue-600">Input (Purchases)</TabsTrigger>
              <TabsTrigger value="output" className="data-[state=active]:bg-emerald-600">Output (Sales)</TabsTrigger>
            </TabsList>

            <TabsContent value="input">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Input Tax Credit Details</CardTitle>
                  <CardDescription className="text-slate-400">GST on purchases (Vendor Bills)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Bill No.</TableHead>
                        <TableHead className="text-slate-400">Vendor</TableHead>
                        <TableHead className="text-slate-400">GSTIN</TableHead>
                        <TableHead className="text-slate-400">Taxable Value</TableHead>
                        <TableHead className="text-slate-400">CGST</TableHead>
                        <TableHead className="text-slate-400">SGST</TableHead>
                        <TableHead className="text-slate-400">IGST</TableHead>
                        <TableHead className="text-slate-400">GSTR-2A</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itcDetails.input?.map(bill => (
                        <TableRow key={bill.id} className="border-slate-700">
                          <TableCell className="text-white font-mono">{bill.bill_number}</TableCell>
                          <TableCell className="text-slate-300">{bill.vendor_name}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-sm">{bill.vendor_gstin || '-'}</TableCell>
                          <TableCell className="text-white">₹{bill.taxable_value?.toLocaleString()}</TableCell>
                          <TableCell className="text-blue-400">₹{bill.cgst?.toLocaleString()}</TableCell>
                          <TableCell className="text-purple-400">₹{bill.sgst?.toLocaleString()}</TableCell>
                          <TableCell className="text-orange-400">₹{bill.igst?.toLocaleString()}</TableCell>
                          <TableCell>
                            {bill.gstr2a_matched ? (
                              <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Matched</Badge>
                            ) : (
                              <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Not Found</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {itcDetails.input?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                            No purchase bills found for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="output">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Output Tax Details</CardTitle>
                  <CardDescription className="text-slate-400">GST on sales (Invoices)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Invoice No.</TableHead>
                        <TableHead className="text-slate-400">Customer</TableHead>
                        <TableHead className="text-slate-400">GSTIN</TableHead>
                        <TableHead className="text-slate-400">Taxable Value</TableHead>
                        <TableHead className="text-slate-400">CGST</TableHead>
                        <TableHead className="text-slate-400">SGST</TableHead>
                        <TableHead className="text-slate-400">IGST</TableHead>
                        <TableHead className="text-slate-400">GSTR-1</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itcDetails.output?.map(inv => (
                        <TableRow key={inv.id} className="border-slate-700">
                          <TableCell className="text-white font-mono">{inv.invoice_number}</TableCell>
                          <TableCell className="text-slate-300">{inv.customer_name}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-sm">{inv.customer_gstin || 'B2C'}</TableCell>
                          <TableCell className="text-white">₹{inv.taxable_value?.toLocaleString()}</TableCell>
                          <TableCell className="text-blue-400">₹{inv.cgst?.toLocaleString()}</TableCell>
                          <TableCell className="text-purple-400">₹{inv.sgst?.toLocaleString()}</TableCell>
                          <TableCell className="text-orange-400">₹{inv.igst?.toLocaleString()}</TableCell>
                          <TableCell>
                            {inv.gstr1_reported ? (
                              <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Reported</Badge>
                            ) : (
                              <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {itcDetails.output?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                            No sales invoices found for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ITCManagement;