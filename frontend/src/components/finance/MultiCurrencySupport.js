import React, { useState, useEffect, useCallback } from 'react';
import { 
  Globe, RefreshCw, ArrowRight, DollarSign, TrendingUp, Building2,
  Plus, Clock, History, Calculator, Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' }
];

export default function MultiCurrencySupport() {
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState({});
  const [payments, setPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Converter state
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('INR');
  const [amount, setAmount] = useState('');
  const [convertedAmount, setConvertedAmount] = useState(null);
  
  // New payment state
  const [newPayment, setNewPayment] = useState({
    vendor_name: '',
    amount_foreign: '',
    currency: 'USD',
    description: ''
  });
  const [creatingPayment, setCreatingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [ratesRes, paymentsRes] = await Promise.all([
        api.get('/finance/phase5/currency/rates'),
        api.get('/finance/phase5/currency/payments')
      ]);
      setRates(ratesRes.data.rates || {});
      setLastUpdated(ratesRes.data.last_updated);
      setPayments(paymentsRes.data.payments || []);
      setPaymentStats({
        totalInr: paymentsRes.data.total_inr || 0,
        byCurrency: paymentsRes.data.by_currency || {}
      });
    } catch (error) {
      console.error('Error fetching currency data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConvert = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    try {
      const response = await api.post('/finance/phase5/currency/convert', {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: parseFloat(amount)
      });
      setConvertedAmount(response.data);
    } catch (error) {
      toast.error('Conversion failed');
    }
  };

  const handleCreatePayment = async () => {
    if (!newPayment.vendor_name || !newPayment.amount_foreign) return;
    
    setCreatingPayment(true);
    try {
      await api.post('/finance/phase5/currency/vendor-payment', null, {
        params: {
          vendor_name: newPayment.vendor_name,
          amount_foreign: parseFloat(newPayment.amount_foreign),
          currency: newPayment.currency,
          description: newPayment.description
        }
      });
      toast.success('Forex payment created');
      setShowPaymentModal(false);
      setNewPayment({ vendor_name: '', amount_foreign: '', currency: 'USD', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create payment');
    } finally {
      setCreatingPayment(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setConvertedAmount(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="multi-currency-support">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="h-7 w-7 text-teal-400" />
            Multi-Currency Support / बहु-मुद्रा समर्थन
          </h1>
          <p className="text-slate-400 mt-1">Live forex rates and international vendor payments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/20 rounded-full border border-teal-500/50">
            <Clock className="h-4 w-4 text-teal-400" />
            <span className="text-teal-400 text-sm">
              Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
            className="border-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Rates
          </Button>
          <Button 
            onClick={() => setShowPaymentModal(true)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Forex Payment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rates" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="rates" className="data-[state=active]:bg-teal-600">
            Live Rates
          </TabsTrigger>
          <TabsTrigger value="converter" className="data-[state=active]:bg-blue-600">
            Converter
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-purple-600">
            Payments ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Live Rates */}
        <TabsContent value="rates">
          <div className="grid grid-cols-5 gap-4">
            {currencies.filter(c => c.code !== 'INR').map(currency => {
              const rate = rates[currency.code] || 0;
              return (
                <Card 
                  key={currency.code}
                  className="bg-slate-800/50 border-slate-700 hover:border-teal-500/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{currency.flag}</span>
                      <div>
                        <p className="text-white font-semibold">{currency.code}</p>
                        <p className="text-xs text-slate-400">{currency.name}</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">₹{rate.toFixed(2)}</span>
                      <span className="text-slate-400 text-sm">/ 1 {currency.code}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Currency Converter */}
        <TabsContent value="converter">
          <Card className="bg-slate-800/50 border-slate-700 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-400" />
                Currency Converter / मुद्रा परिवर्तक
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-5 gap-4 items-center">
                {/* From Currency */}
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1">From</label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {currencies.map(c => (
                        <SelectItem key={c.code} value={c.code} className="text-white">
                          {c.flag} {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setConvertedAmount(null); }}
                    placeholder="Enter amount"
                    className="mt-2 bg-slate-900 border-slate-700 text-white text-lg"
                  />
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={swapCurrencies}
                    className="rounded-full border-slate-600"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* To Currency */}
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1">To</label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {currencies.map(c => (
                        <SelectItem key={c.code} value={c.code} className="text-white">
                          {c.flag} {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded-md">
                    {convertedAmount ? (
                      <p className="text-2xl font-bold text-white">
                        {currencies.find(c => c.code === toCurrency)?.symbol}
                        {convertedAmount.converted_amount.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-slate-500">Enter amount to convert</p>
                    )}
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleConvert}
                disabled={!amount || parseFloat(amount) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Convert
              </Button>

              {convertedAmount && (
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-400">
                    Exchange Rate: 1 {fromCurrency} = {convertedAmount.rate_used} {toCurrency}
                  </p>
                  <p className="text-lg text-white mt-2">
                    {currencies.find(c => c.code === fromCurrency)?.symbol}{parseFloat(amount).toLocaleString()} {fromCurrency} = 
                    <span className="text-teal-400 font-bold ml-2">
                      {currencies.find(c => c.code === toCurrency)?.symbol}{convertedAmount.converted_amount.toLocaleString()} {toCurrency}
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forex Payments */}
        <TabsContent value="payments">
          {/* Payment Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-teal-600/30 to-teal-800/30 border-teal-500/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-200 text-sm">Total INR Value</p>
                    <p className="text-3xl font-bold text-white mt-1">{formatINR(paymentStats.totalInr)}</p>
                  </div>
                  <Banknote className="h-10 w-10 text-teal-400 opacity-80" />
                </div>
              </CardContent>
            </Card>
            
            {Object.entries(paymentStats.byCurrency || {}).slice(0, 3).map(([currency, amount]) => (
              <Card key={currency} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">{currency} Total</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {currencies.find(c => c.code === currency)?.symbol || ''}{amount.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-3xl">{currencies.find(c => c.code === currency)?.flag || '💱'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payments List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-purple-400" />
                Forex Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No forex payments yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Create First Payment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(payment => {
                    const currency = currencies.find(c => c.code === payment.original_currency);
                    return (
                      <div 
                        key={payment.id || payment._id}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{currency?.flag || '💱'}</span>
                          <div>
                            <h4 className="text-white font-medium">{payment.vendor_name}</h4>
                            <p className="text-sm text-slate-400">
                              {payment.description || 'International vendor payment'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            {currency?.symbol || ''}{payment.original_amount?.toLocaleString()} {payment.original_currency}
                          </p>
                          <p className="text-sm text-teal-400">
                            = {formatINR(payment.inr_amount)} @ {payment.exchange_rate}
                          </p>
                          <Badge className={`mt-1 ${
                            payment.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          } border-0`}>
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-400" />
              Create Forex Payment / विदेशी मुद्रा भुगतान
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Vendor Name *</label>
              <Input
                value={newPayment.vendor_name}
                onChange={(e) => setNewPayment({...newPayment, vendor_name: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., Boeing, Airbus"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Currency *</label>
                <Select 
                  value={newPayment.currency} 
                  onValueChange={(v) => setNewPayment({...newPayment, currency: v})}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {currencies.filter(c => c.code !== 'INR').map(c => (
                      <SelectItem key={c.code} value={c.code} className="text-white">
                        {c.flag} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Amount *</label>
                <Input
                  type="number"
                  value={newPayment.amount_foreign}
                  onChange={(e) => setNewPayment({...newPayment, amount_foreign: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <Input
                value={newPayment.description}
                onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Optional description"
              />
            </div>
            {newPayment.amount_foreign && rates[newPayment.currency] && (
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/30">
                <p className="text-teal-400 text-sm">
                  Estimated INR: <span className="font-bold">
                    {formatINR(parseFloat(newPayment.amount_foreign) * rates[newPayment.currency])}
                  </span>
                  <span className="text-slate-400 ml-2">@ ₹{rates[newPayment.currency]}/{newPayment.currency}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePayment}
              disabled={creatingPayment || !newPayment.vendor_name || !newPayment.amount_foreign}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {creatingPayment ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
