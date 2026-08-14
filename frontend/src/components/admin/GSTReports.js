import React, { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, FileDown, Loader2, IndianRupee, Receipt, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);
const currentFYStart = () => {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
const fyOptions = () => {
  const cur = currentFYStart();
  return [0, 1, 2, 3, 4].map(i => {
    const y = cur - i;
    return { value: String(y), label: `FY ${y}-${String(y + 1).slice(2)}` };
  });
};

export default function GSTReports() {
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(thisMonth());
  const [fy, setFy] = useState(String(currentFYStart()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');

  const load = useCallback(async (m, md, f) => {
    setLoading(true);
    try {
      const url = md === 'fy' ? `/gst-reports/yearly?fy=${f}` : `/gst-reports/monthly?month=${m}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month, mode, fy); }, [month, mode, fy, load]);

  const download = async (format) => {
    setDownloading(format);
    try {
      const token = localStorage.getItem('token');
      const path = mode === 'fy'
        ? `/api/gst-reports/yearly/export?fy=${fy}&format=${format}`
        : `/api/gst-reports/monthly/export?month=${month}&format=${format}`;
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}${path}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'fy'
        ? `AirYatra_GST_TDS_FY_${fy}-${String(Number(fy) + 1).slice(2)}.${format}`
        : `AirYatra_GST_TDS_Report_${month}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error('Download failed');
    } finally {
      setDownloading('');
    }
  };

  const s = data?.summary;

  return (
    <div data-testid="gst-reports-panel">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Receipt className="h-7 w-7 text-orange-400" /> GST/TDS Reports / जीएसटी रिपोर्ट
          </h1>
          <p className="text-slate-400 mt-1">Monthly bookings & refunds with invoice, GST @{s?.gst_rate ?? 5}% and TDS @{s?.tds_rate ?? 1}% — Excel/PDF download.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => setMode('month')}
              className={`px-3 py-2 text-sm ${mode === 'month' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}
              data-testid="mode-month-btn"
            >Monthly</button>
            <button
              onClick={() => setMode('fy')}
              className={`px-3 py-2 text-sm ${mode === 'fy' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}
              data-testid="mode-fy-btn"
            >Financial Year</button>
          </div>
          {mode === 'month' ? (
            <input
              type="month"
              value={month}
              max={thisMonth()}
              onChange={(e) => setMonth(e.target.value)}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              data-testid="gst-month-input"
            />
          ) : (
            <select
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
              data-testid="gst-fy-select"
            >
              {fyOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <Button onClick={() => download('xlsx')} disabled={!!downloading || loading}
            className="bg-green-600 hover:bg-green-700" data-testid="download-excel-btn">
            {downloading === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            Excel
          </Button>
          <Button onClick={() => download('pdf')} disabled={!!downloading || loading}
            className="bg-red-600 hover:bg-red-700" data-testid="download-pdf-btn">
            {downloading === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
            PDF
          </Button>
          <Button variant="outline" size="icon" onClick={() => load(month, mode, fy)} className="border-slate-600 text-slate-300" data-testid="refresh-gst-btn">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
      ) : !data ? (
        <p className="text-slate-500 text-center py-10">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Bookings', value: s.total_bookings, color: 'text-white' },
              { label: 'Total Amount', value: fmt(s.total_amount), color: 'text-orange-400' },
              { label: 'Taxable Value', value: fmt(s.total_taxable), color: 'text-blue-400' },
              { label: `GST @${s.gst_rate}%`, value: fmt(s.total_gst), color: 'text-green-400' },
              { label: `TDS @${s.tds_rate}%`, value: fmt(s.total_tds), color: 'text-purple-400' },
              { label: `Refunds (${s.total_refunds})`, value: fmt(s.total_refund_amount), color: 'text-red-400' },
            ].map((c) => (
              <div key={c.label} className="glass p-4 rounded-xl" data-testid={`gst-card-${c.label.split(' ')[0].toLowerCase()}`}>
                <p className="text-slate-400 text-xs">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {data.monthly_breakdown && (
            <div className="glass rounded-xl overflow-x-auto mb-8" data-testid="fy-breakdown-table">
              <p className="px-3 pt-3 text-white font-semibold">Month-wise Summary — {data.summary.month}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-left">
                    {['Month', 'Bookings', 'Amount', 'Taxable', 'GST', 'TDS', 'Refunds', 'Refund Amt'].map(h => (
                      <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.monthly_breakdown.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Is FY me koi data nahi</td></tr>
                  ) : data.monthly_breakdown.map((b) => (
                    <tr key={b.month} className="border-b border-slate-800 text-slate-200">
                      <td className="px-3 py-2 text-orange-300">{b.month}</td>
                      <td className="px-3 py-2">{b.bookings}</td>
                      <td className="px-3 py-2">{fmt(b.amount)}</td>
                      <td className="px-3 py-2 text-blue-400">{fmt(b.taxable)}</td>
                      <td className="px-3 py-2 text-green-400">{fmt(b.gst)}</td>
                      <td className="px-3 py-2 text-purple-400">{fmt(b.tds)}</td>
                      <td className="px-3 py-2">{b.refunds}</td>
                      <td className="px-3 py-2 text-red-400">{fmt(b.refund_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass rounded-xl overflow-x-auto mb-8">
            <table className="w-full text-sm" data-testid="gst-bookings-table">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  {['Client', 'Booking ID', 'Bkg Date', 'Amount', 'GST', 'TDS', 'Invoice No', 'Inv Date', 'Refund ID', 'Ref Amt', 'Pay Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bookings.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-500">Is month me koi booking nahi</td></tr>
                ) : data.bookings.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800 text-slate-200">
                    <td className="px-3 py-2 whitespace-nowrap">{r.client_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-orange-300">{r.booking_id}</td>
                    <td className="px-3 py-2">{r.booking_date}</td>
                    <td className="px-3 py-2">{fmt(r.amount)}</td>
                    <td className="px-3 py-2 text-green-400">{fmt(r.gst_amount)}</td>
                    <td className="px-3 py-2 text-purple-400">{fmt(r.tds_amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.invoice_no}</td>
                    <td className="px-3 py-2">{r.invoice_date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.refund_id}</td>
                    <td className="px-3 py-2 text-red-400">{r.refund_amount ? fmt(r.refund_amount) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${['paid', 'fully_paid'].includes(r.payment_status) ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                        {r.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-red-400" /> Refunds Approved — {data.summary.month}
          </h2>
          <div className="glass rounded-xl overflow-x-auto">
            <table className="w-full text-sm" data-testid="gst-refunds-table">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  {['Refund ID', 'Booking ID', 'Type', 'Initiated By', 'Paid', 'Deduction %', 'Refund Amt', 'Date', 'Gateway'].map(h => (
                    <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.refunds.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Is month me koi approved refund nahi</td></tr>
                ) : data.refunds.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800 text-slate-200">
                    <td className="px-3 py-2 whitespace-nowrap">{r.refund_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-orange-300">{r.booking_id}</td>
                    <td className="px-3 py-2">{r.refund_type}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{(r.initiated_by || '').replace('_', ' ')}</td>
                    <td className="px-3 py-2">{fmt(r.amount_paid)}</td>
                    <td className="px-3 py-2">{r.deduction_pct}%</td>
                    <td className="px-3 py-2 text-red-400 font-semibold">{fmt(r.refund_amount)}</td>
                    <td className="px-3 py-2">{r.refund_date}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${r.gateway_status === 'processed' ? 'bg-green-500/20 text-green-400' : r.gateway_status === 'manual' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'}`}>
                        {r.gateway_status}
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
