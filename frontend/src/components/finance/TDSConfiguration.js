import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Percent,
  Calculator,
  Plus,
  Save,
  RefreshCw,
  FileText,
  Info
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const TDSConfiguration = () => {
  const [tdsConfig, setTdsConfig] = useState(null);
  const [tdsSections, setTdsSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCustomRateDialog, setShowCustomRateDialog] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  
  const [customRate, setCustomRate] = useState({
    vendor_id: '',
    vendor_name: '',
    tds_section: '194C',
    rate: 0,
    reason: ''
  });
  
  const [calcInput, setCalcInput] = useState({
    vendor_type: 'individual',
    tds_section: '194C',
    amount: 100000,
    has_pan: true
  });
  const [calcResult, setCalcResult] = useState(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, sectionsRes] = await Promise.all([
        api.get('/payments/tds/config'),
        api.get('/payments/tds/sections')
      ]);
      setTdsConfig(configRes.data);
      setTdsSections(sectionsRes.data.sections || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.post('/payments/tds/config', {
        rates: tdsConfig.rates
      });
      toast.success('TDS configuration saved!');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
    setSaving(false);
  };

  const addCustomRate = async () => {
    try {
      await api.post('/payments/tds/custom-rate', customRate);
      toast.success('Custom rate added!');
      setShowCustomRateDialog(false);
      setCustomRate({ vendor_id: '', vendor_name: '', tds_section: '194C', rate: 0, reason: '' });
      fetchConfig();
    } catch (error) {
      toast.error('Failed to add custom rate');
    }
  };

  const calculateTDS = async () => {
    try {
      const response = await api.post('/payments/tds/calculate', calcInput);
      setCalcResult(response.data);
    } catch (error) {
      toast.error('Calculation failed');
    }
  };

  const updateRate = (section, vendorType, newRate) => {
    setTdsConfig(prev => ({
      ...prev,
      rates: {
        ...prev.rates,
        [section]: {
          ...prev.rates[section],
          [vendorType]: parseFloat(newRate)
        }
      }
    }));
  };

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
          <h2 className="text-2xl font-bold text-white">TDS Configuration</h2>
          <p className="text-slate-400">Manage Tax Deducted at Source rates and settings</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <Calculator className="h-4 w-4 mr-2" />
                TDS Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">TDS Calculator</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Vendor Type</label>
                    <Select value={calcInput.vendor_type} onValueChange={(v) => setCalcInput({...calcInput, vendor_type: v})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="individual" className="text-white">Individual/HUF</SelectItem>
                        <SelectItem value="company" className="text-white">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">TDS Section</label>
                    <Select value={calcInput.tds_section} onValueChange={(v) => setCalcInput({...calcInput, tds_section: v})}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {tdsSections.map(s => (
                          <SelectItem key={s.code} value={s.code} className="text-white">
                            {s.code} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Amount (₹)</label>
                  <Input 
                    type="number"
                    value={calcInput.amount}
                    onChange={(e) => setCalcInput({...calcInput, amount: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    checked={calcInput.has_pan}
                    onChange={(e) => setCalcInput({...calcInput, has_pan: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <label className="text-sm text-slate-400">Vendor has PAN</label>
                </div>
                <Button onClick={calculateTDS} className="w-full bg-emerald-600">
                  Calculate
                </Button>
                
                {calcResult && (
                  <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                    <div className="text-center mb-4">
                      <p className="text-slate-400 text-sm">{calcResult.section_name}</p>
                      <p className="text-emerald-400 text-2xl font-bold">{calcResult.tds_section}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gross Amount:</span>
                        <span className="text-white">₹{calcInput.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">TDS Rate:</span>
                        <span className="text-white">{calcResult.rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Base TDS:</span>
                        <span className="text-red-400">₹{calcResult.base_tds?.toLocaleString()}</span>
                      </div>
                      {calcResult.surcharge > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Surcharge:</span>
                          <span className="text-red-400">₹{calcResult.surcharge?.toLocaleString()}</span>
                        </div>
                      )}
                      {calcResult.cess > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Cess (4%):</span>
                          <span className="text-red-400">₹{calcResult.cess?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-700 pt-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total TDS:</span>
                          <span className="text-red-400 font-semibold">₹{calcResult.tds_amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-slate-400">Net Payable:</span>
                          <span className="text-emerald-400 font-bold text-lg">₹{calcResult.net_payable?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {calcResult.no_pan_higher_rate && (
                      <Alert className="bg-yellow-500/10 border-yellow-500/30">
                        <AlertDescription className="text-yellow-400 text-sm">
                          ⚠️ 20% rate applied due to missing PAN (Section 206AA)
                        </AlertDescription>
                      </Alert>
                    )}
                    {calcResult.below_threshold && (
                      <Alert className="bg-blue-500/10 border-blue-500/30">
                        <AlertDescription className="text-blue-400 text-sm">
                          ℹ️ Amount below threshold (₹{calcResult.threshold?.toLocaleString()}). No TDS applicable.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCustomRateDialog} onOpenChange={setShowCustomRateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-500 text-emerald-400">
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add Custom TDS Rate</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm text-slate-400">Vendor ID</label>
                  <Input 
                    value={customRate.vendor_id}
                    onChange={(e) => setCustomRate({...customRate, vendor_id: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Enter vendor ID"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Vendor Name</label>
                  <Input 
                    value={customRate.vendor_name}
                    onChange={(e) => setCustomRate({...customRate, vendor_name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">TDS Section</label>
                  <Select value={customRate.tds_section} onValueChange={(v) => setCustomRate({...customRate, tds_section: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {tdsSections.map(s => (
                        <SelectItem key={s.code} value={s.code} className="text-white">
                          {s.code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Custom Rate (%)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={customRate.rate}
                    onChange={(e) => setCustomRate({...customRate, rate: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Reason</label>
                  <Input 
                    value={customRate.reason}
                    onChange={(e) => setCustomRate({...customRate, reason: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Lower deduction certificate, etc."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCustomRateDialog(false)} className="border-slate-600 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={addCustomRate} className="bg-emerald-600">
                  Add Custom Rate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button onClick={saveConfig} disabled={saving} className="bg-emerald-600">
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-400">
          TDS rates are as per Income Tax Act. Surcharge applies for payments exceeding ₹1 Crore. Health & Education Cess of 4% applies on TDS + Surcharge.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="rates" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="rates" className="data-[state=active]:bg-emerald-600">Standard Rates</TabsTrigger>
          <TabsTrigger value="custom" className="data-[state=active]:bg-emerald-600">Custom Rates</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-emerald-600">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="rates">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Standard TDS Rates</CardTitle>
              <CardDescription className="text-slate-400">Default rates as per Income Tax Act</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Section</TableHead>
                    <TableHead className="text-slate-400">Nature of Payment</TableHead>
                    <TableHead className="text-slate-400">Individual/HUF (%)</TableHead>
                    <TableHead className="text-slate-400">Company (%)</TableHead>
                    <TableHead className="text-slate-400">Threshold (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tdsSections.map(section => (
                    <TableRow key={section.code} className="border-slate-700">
                      <TableCell>
                        <Badge className="bg-emerald-500/20 text-emerald-400">
                          {section.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white">{section.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Input 
                            type="number"
                            step="0.1"
                            value={tdsConfig?.rates?.[section.code]?.individual || section.individual_rate}
                            onChange={(e) => updateRate(section.code, 'individual', e.target.value)}
                            className="w-20 bg-slate-800 border-slate-700 text-white text-center"
                          />
                          <Percent className="h-4 w-4 text-slate-500" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Input 
                            type="number"
                            step="0.1"
                            value={tdsConfig?.rates?.[section.code]?.company || section.company_rate}
                            onChange={(e) => updateRate(section.code, 'company', e.target.value)}
                            className="w-20 bg-slate-800 border-slate-700 text-white text-center"
                          />
                          <Percent className="h-4 w-4 text-slate-500" />
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        ₹{section.threshold?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Custom Vendor Rates</CardTitle>
              <CardDescription className="text-slate-400">Special rates for specific vendors (Lower Deduction Certificates, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(tdsConfig?.custom_rates || {}).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No custom rates configured</p>
                  <p className="text-slate-500 text-sm">Add custom rates for vendors with special TDS certificates</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Vendor</TableHead>
                      <TableHead className="text-slate-400">Section</TableHead>
                      <TableHead className="text-slate-400">Custom Rate</TableHead>
                      <TableHead className="text-slate-400">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(tdsConfig?.custom_rates || {}).map(([vendorId, data]) => (
                      <TableRow key={vendorId} className="border-slate-700">
                        <TableCell className="text-white">{data.vendor_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {data.tds_section}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-400 font-semibold">{data.rate}%</TableCell>
                        <TableCell className="text-slate-400">{data.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">TDS Settings</CardTitle>
              <CardDescription className="text-slate-400">Additional TDS configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-slate-400">Surcharge Threshold (₹)</label>
                  <Input 
                    type="number"
                    value={tdsConfig?.surcharge_threshold || 10000000}
                    onChange={(e) => setTdsConfig({...tdsConfig, surcharge_threshold: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                  <p className="text-slate-500 text-xs mt-1">Surcharge applies above this amount</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Surcharge Rate (%)</label>
                  <Input 
                    type="number"
                    step="0.1"
                    value={tdsConfig?.surcharge_rate || 10}
                    onChange={(e) => setTdsConfig({...tdsConfig, surcharge_rate: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Health & Education Cess (%)</label>
                  <Input 
                    type="number"
                    step="0.1"
                    value={tdsConfig?.cess_rate || 4}
                    onChange={(e) => setTdsConfig({...tdsConfig, cess_rate: Number(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>
              
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertDescription className="text-yellow-400 text-sm">
                  <strong>Section 206AA:</strong> If vendor does not provide PAN, TDS will be deducted at higher of:
                  (a) Rate specified in Act, (b) Rate in force, or (c) 20%
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TDSConfiguration;