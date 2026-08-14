import React, { useState, useEffect } from 'react';
import { BanknoteIcon, Calculator, CheckCircle, Clock, CreditCard, Building, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/apiClient';

export default function AutoSalaryPayment({ user }) {
  const [calculations, setCalculations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [bankDetails, setBankDetails] = useState(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    account_holder_name: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'savings'
  });

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = async () => {
    try {
      const res = await api.get('/hr/salary/payment-history');
      setPayments(res.data.payments || []);
    } catch (error) {
      console.error('Failed to load payment history:', error);
    }
  };

  const calculateSalary = async () => {
    setLoading(true);
    try {
      const res = await api.post('/hr/salary/calculate-auto', {
        month: selectedMonth,
        year: selectedYear
      });
      setCalculations(res.data.calculations || []);
      if (res.data.calculations?.length === 0) {
        alert('No employees found with active salary structure');
      }
    } catch (error) {
      alert('Failed to calculate salary');
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async () => {
    if (!window.confirm('Are you sure you want to initiate salary payment for all approved payrolls?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/hr/salary/initiate-payment', {
        month: selectedMonth,
        year: selectedYear
      });
      alert(`Payment initiated for ${res.data.payments?.length || 0} employees. Total: ₹${res.data.total_amount?.toLocaleString()}`);
      loadPaymentHistory();
    } catch (error) {
      alert('Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const saveBankDetails = async () => {
    try {
      await api.post('/hr/salary/bank-details', bankForm);
      setShowBankForm(false);
      alert('Bank details saved successfully');
    } catch (error) {
      alert('Failed to save bank details');
    }
  };

  const addExpensesToSalary = async () => {
    try {
      const res = await api.post('/hr/expense/add-to-salary', {
        month: selectedMonth,
        year: selectedYear
      });
      alert(`Added ${res.data.added_count} expenses (₹${res.data.total_amount?.toLocaleString()}) to salary`);
      calculateSalary();
    } catch (error) {
      alert('Failed to add expenses');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Auto Salary Payment</h2>
          <p className="text-slate-400">Calculate salary based on attendance and process payments</p>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <Label className="text-slate-300">Month</Label>
              <select
                className="w-40 bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{new Date(2024, m-1).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Year</Label>
              <select
                className="w-32 bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {[2023, 2024, 2025].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button onClick={calculateSalary} disabled={loading} className="bg-blue-500 hover:bg-blue-600">
              <Calculator className="h-4 w-4 mr-2" /> Calculate Salary</Button>
            <Button onClick={addExpensesToSalary} variant="outline">
              Add Approved Expenses</Button>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Info */}
      <Card className="bg-blue-500/10 border-blue-500/50">
        <CardContent className="pt-6">
          <h3 className="text-blue-400 font-medium mb-3">Auto Salary Payment Workflow</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center text-slate-300">
              <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">1</span>
              Calculate Salary
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center text-slate-300">
              <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">2</span>
              HR Approval
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center text-slate-300">
              <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">3</span>
              Admin Approval
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center text-slate-300">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs mr-2">4</span>
              Auto Bank Transfer
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculated Salaries */}
      {calculations.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Salary Calculations{calculations.length} employees)</CardTitle>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">₹{calculations.reduce((sum, c) => sum + c.net_salary, 0).toLocaleString()}</p>
                <p className="text-slate-400 text-sm">Total Payout</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 text-slate-400">Employee</th>
                    <th className="text-center py-3 text-slate-400">Days</th>
                    <th className="text-right py-3 text-slate-400">Basic</th>
                    <th className="text-right py-3 text-slate-400">Allowances</th>
                    <th className="text-right py-3 text-slate-400">Incentives</th>
                    <th className="text-right py-3 text-slate-400">Reimburse</th>
                    <th className="text-right py-3 text-slate-400">Deductions</th>
                    <th className="text-right py-3 text-slate-400 text-green-400">Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.map((calc, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50">
                      <td className="py-3">
                        <p className="text-white">{calc.employee_name}</p>
                        <p className="text-slate-400 text-xs">{calc.effective_days}/{calc.working_days} days</p>
                      </td>
                      <td className="text-center">
                        <span className="text-green-400">{calc.present_days}P</span>
                        {calc.half_days > 0 && <span className="text-yellow-400 ml-1">{calc.half_days}H</span>}
                        {calc.leaves > 0 && <span className="text-red-400 ml-1">{calc.leaves}L</span>}
                      </td>
                      <td className="text-right text-white">₹{calc.basic?.toLocaleString()}</td>
                      <td className="text-right text-white">₹{(calc.hra + calc.allowances)?.toLocaleString()}</td>
                      <td className="text-right text-blue-400">₹{calc.incentives?.toLocaleString()}</td>
                      <td className="text-right text-purple-400">₹{calc.reimbursements?.toLocaleString()}</td>
                      <td className="text-right text-red-400">-₹{calc.total_deductions?.toLocaleString()}</td>
                      <td className="text-right font-bold text-green-400">₹{calc.net_salary?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={initiatePayment} disabled={loading} className="bg-green-500 hover:bg-green-600">
                <BanknoteIcon className="h-4 w-4 mr-2" /> Initiate Payment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Details Form */}
      {showBankForm && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Account Holder Name</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  value={bankForm.account_holder_name}
                  onChange={(e) => setBankForm({...bankForm, account_holder_name: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Bank Name</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({...bankForm, bank_name: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Account Number</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">IFSC Code</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  value={bankForm.ifsc_code}
                  onChange={(e) => setBankForm({...bankForm, ifsc_code: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveBankDetails} className="bg-green-500">Save Bank Details</Button>
              <Button variant="outline" onClick={() => setShowBankForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No payment history</p>
          ) : (
            <div className="space-y-3">
              {payments.slice(0, 10).map((payment, idx) => (
                <div key={idx} className="p-4 bg-slate-700/50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{payment.employee_name}</p>
                    <p className="text-slate-400 text-sm">{payment.bank_name} • ****{payment.account_number}</p>
                    <p className="text-slate-400 text-xs">{new Date(payment.initiated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">₹{payment.amount?.toLocaleString()}</p>
                    <span className={`px-2 py-1 rounded text-xs ${
                      payment.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      payment.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {payment.status}
                    </span>
                    {payment.utr_number && (
                      <p className="text-slate-400 text-xs mt-1">UTR: {payment.utr_number}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
