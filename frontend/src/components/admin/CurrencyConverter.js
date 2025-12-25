import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, ArrowRight, TrendingUp, TrendingDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function CurrencyConverter() {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(10000);
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [result, setResult] = useState(null);

  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    try {
      const res = await api.get('/currency/rates');
      setRates(res.data.rates || {});
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const convert = () => {
    if (!rates[fromCurrency] || !rates[toCurrency]) {
      alert('Rates not available');
      return;
    }
    const inUSD = amount / rates[fromCurrency];
    const converted = inUSD * rates[toCurrency];
    setResult(converted.toFixed(2));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <DollarSign className="h-6 w-6 mr-2 text-green-500" /> Currency Converter
          </h1>
          <p className="text-slate-400">Multi-currency support for international bookings</p>
        </div>
        <Button onClick={loadRates} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Convert Currency</h2>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} className="bg-slate-700 text-2xl py-6" />
          </div>
          <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="p-3 bg-slate-700 rounded-lg border border-slate-600 text-white">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ArrowRight className="h-6 w-6 text-slate-400" />
          <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="p-3 bg-slate-700 rounded-lg border border-slate-600 text-white">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button onClick={convert} className="bg-orange-500 px-8">Convert</Button>
        </div>
        {result && (
          <div className="mt-6 text-center p-4 bg-green-500/20 rounded-lg border border-green-500/30">
            <p className="text-green-400 text-sm">Converted Amount</p>
            <p className="text-white text-4xl font-bold">{toCurrency} {result}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Exchange Rates (Base: USD)</h2>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(rates).map(([currency, rate]) => (
            <div key={currency} className="bg-slate-900 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">{currency}</p>
              <p className="text-white text-xl font-bold">{rate.toFixed(4)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CurrencyConverter;
