import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

export const EmpPayslips = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/payroll/my-salary-slip', { params: { month, year } });
      setSlip(res.data.slip);
    } catch (e) { setSlip(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/hr/payroll/${slip.id}/payslip.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `AirYatra_Payslip_${slip.period?.replace(' ', '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Payslip downloaded');
    } catch (e) {
      toast.error('Failed to download payslip');
    } finally { setDownloading(false); }
  };

  const earnRows = slip ? [
    ['Basic Salary', slip.basic_salary], ['HRA', slip.hra], ['Conveyance', slip.conveyance],
    ['Medical Allowance', slip.medical_allowance], ['Special Allowance', slip.special_allowance],
    ['Other Allowances', slip.other_allowances], ['Incentives', slip.incentives],
  ] : [];
  const dedRows = slip ? [
    ['PF', slip.pf_deduction], ['ESI', slip.esi_deduction], ['Professional Tax', slip.professional_tax], ['TDS', slip.tds],
  ] : [];

  return (
    <div className="space-y-6" data-testid="emp-payslips">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Payslips</h1>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm" data-testid="payslip-month-select">
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleString('en', { month: 'long' })}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm">
            {[year - 1, year].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : !slip ? (
        <div className="bg-slate-800/50 rounded-xl p-10 text-center border border-slate-700">
          <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">No payslip for this month</p>
          <p className="text-slate-400 text-sm">Payroll may not be generated yet. Contact HR.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden" data-testid="payslip-card">
          <div className="bg-slate-900/70 p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white font-semibold text-lg">{slip.period}</p>
              <p className="text-slate-400 text-sm">Days worked: {slip.effective_working_days} / {slip.working_days_in_month} • Status: <span className="uppercase text-sky-400">{slip.status}</span></p>
            </div>
            <Button onClick={downloadPdf} disabled={downloading} className="bg-orange-500 hover:bg-orange-600" data-testid="download-payslip-btn">
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Download PDF
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6 p-5">
            <div>
              <h3 className="text-green-400 font-semibold mb-2">Earnings</h3>
              {earnRows.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-slate-700/50 text-sm">
                  <span className="text-slate-400">{k}</span><span className="text-white">₹{(v || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-sm"><span className="text-white">Gross</span><span className="text-green-400">₹{(slip.gross_earnings || 0).toLocaleString()}</span></div>
            </div>
            <div>
              <h3 className="text-red-400 font-semibold mb-2">Deductions</h3>
              {dedRows.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-slate-700/50 text-sm">
                  <span className="text-slate-400">{k}</span><span className="text-white">₹{(v || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-sm"><span className="text-white">Total Deductions</span><span className="text-red-400">₹{(slip.total_deductions || 0).toLocaleString()}</span></div>
            </div>
          </div>
          <div className="bg-orange-500/15 border-t border-orange-500/40 p-4 flex justify-between items-center">
            <span className="text-white font-semibold">NET SALARY</span>
            <span className="text-orange-400 text-2xl font-bold" data-testid="net-salary-amount">₹{(slip.net_salary || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpPayslips;
