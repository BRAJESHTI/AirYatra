import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, RefreshCw, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const badge = (s) => (['paid', 'captured', 'verified'].includes(s)
  ? 'bg-green-500/20 text-green-400'
  : s === 'created' || s === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
  : 'bg-red-500/20 text-red-400');

export default function PaymentTransactions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/razorpay/transactions');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div data-testid="payment-transactions">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-orange-400" /> Payment Transactions
          </h1>
          <p className="text-slate-400 text-sm">All gateway payment orders across bookings.</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} className="border-slate-600 text-slate-300" data-testid="refresh-txns-btn">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Transactions', value: data.totals.total, color: 'text-white' },
              { label: 'Paid', value: data.totals.paid, color: 'text-green-400' },
              { label: 'Pending', value: data.totals.pending, color: 'text-yellow-400' },
              { label: 'Collected Amount', value: fmt(data.totals.total_amount), color: 'text-orange-400' },
            ].map((c) => (
              <div key={c.label} className="glass p-4 rounded-xl">
                <p className="text-slate-400 text-xs">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-xl overflow-x-auto">
            <table className="w-full text-sm" data-testid="transactions-table">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  {['Order ID', 'Booking', 'Customer', 'Amount', 'Status', 'Payment ID', 'Date', 'Mode'].map(h => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No transactions yet</td></tr>
                ) : data.transactions.map((t, i) => (
                  <tr key={t.order_id || i} className="border-b border-slate-800 text-slate-200">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{t.order_id}</td>
                    <td className="px-4 py-3 text-orange-300 whitespace-nowrap">{t.booking_ref || t.receipt || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.customer_name || '—'}</td>
                    <td className="px-4 py-3 font-semibold flex items-center gap-0.5"><IndianRupee className="h-3 w-3" />{Number(t.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${badge(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{t.payment_id || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{(t.created_at || '').slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.mock ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
                        {t.mock ? 'TEST' : 'LIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
