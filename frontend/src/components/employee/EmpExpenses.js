import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const CATEGORIES = ['travel', 'food', 'accommodation', 'fuel', 'office_supplies', 'client_entertainment', 'training', 'medical', 'communication', 'other'];

const STATUS_STYLES = {
  draft: 'bg-slate-500/20 text-slate-300',
  hr_pending: 'bg-yellow-500/20 text-yellow-400',
  finance_pending: 'bg-yellow-500/20 text-yellow-400',
  admin_pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  added_to_salary: 'bg-sky-500/20 text-sky-400',
  paid: 'bg-green-500/20 text-green-400',
};

export const EmpExpenses = ({ onChanged }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'travel', amount: '', expense_date: '', description: '' });
  const [receipt, setReceipt] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/hr/expense/my');
      setData(res.data);
    } catch (e) { toast.error('Failed to load expenses'); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.amount || !form.expense_date) return toast.error('Title, amount aur date required hai');
    if (!receipt) return toast.error('Receipt attach karna zaroori hai / रसीद संलग्न करें');
    setSaving(true);
    try {
      const res = await api.post('/hr/expense/create', { ...form, amount: Number(form.amount) });
      const expenseId = res.data.expense_id;
      const fd = new FormData();
      fd.append('file', receipt);
      fd.append('document_type', 'receipt');
      await api.post(`/hr/expense/${expenseId}/upload-document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.put(`/hr/expense/${expenseId}/submit`);
      toast.success('Expense claim submitted for approval / क्लेम अनुमोदन के लिए भेजा गया');
      setOpen(false);
      setForm({ title: '', category: 'travel', amount: '', expense_date: '', description: '' });
      setReceipt(null);
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create claim');
    } finally { setSaving(false); }
  };

  const submitDraft = async (id) => {
    setSubmitting(id);
    try {
      await api.put(`/hr/expense/${id}/submit`);
      toast.success('Submitted for approval');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit');
    } finally { setSubmitting(null); }
  };

  const summary = data?.summary || {};

  return (
    <div className="space-y-6" data-testid="emp-expenses">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Expenses / खर्च क्लेम</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-500 hover:bg-purple-600" data-testid="new-expense-btn"><Plus className="h-4 w-4 mr-2" />New Claim / नया क्लेम</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader><DialogTitle>New Expense Claim / नया खर्च क्लेम</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Title / शीर्षक</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Client visit taxi fare" className="bg-slate-800 border-slate-700 mt-1" data-testid="expense-title-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Category</Label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="expense-category-select">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">Amount (₹)</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="expense-amount-input" />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Expense Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="expense-date-input" />
              </div>
              <div>
                <Label className="text-slate-300">Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Receipt / रसीद (required)</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files[0])} className="bg-slate-800 border-slate-700 mt-1 file:text-slate-300" data-testid="expense-receipt-input" />
              </div>
              <Button onClick={create} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-600" data-testid="submit-expense-btn">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit Claim / क्लेम जमा करें
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-yellow-400">₹{(summary.total_pending || 0).toLocaleString()}</p>
          <p className="text-slate-400 text-xs">Pending / लंबित</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-green-400">₹{(summary.total_approved || 0).toLocaleString()}</p>
          <p className="text-slate-400 text-xs">Approved / स्वीकृत</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-sky-400">₹{(summary.total_paid || 0).toLocaleString()}</p>
          <p className="text-slate-400 text-xs">Reimbursed / भुगतान</p>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {!data?.expenses?.length ? (
          <div className="p-8 text-center text-slate-400"><Receipt className="h-10 w-10 mx-auto mb-2 text-slate-600" />No expense claims yet / अभी कोई क्लेम नहीं</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 text-slate-400">Claim</th>
                <th className="text-left p-3 text-slate-400">Category</th>
                <th className="text-left p-3 text-slate-400">Date</th>
                <th className="text-right p-3 text-slate-400">Amount</th>
                <th className="text-center p-3 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-700/60" data-testid={`expense-row-${e.id}`}>
                  <td className="p-3">
                    <p className="text-white">{e.title}</p>
                    <p className="text-slate-500 text-xs">{e.expense_number}</p>
                  </td>
                  <td className="p-3 text-slate-300 capitalize">{e.category?.replace('_', ' ')}</td>
                  <td className="p-3 text-slate-300">{e.expense_date}</td>
                  <td className="p-3 text-right text-white font-medium">₹{e.amount?.toLocaleString()}</td>
                  <td className="p-3 text-center">
                    {e.status === 'draft' ? (
                      <Button size="sm" onClick={() => submitDraft(e.id)} disabled={submitting === e.id} className="bg-purple-500 hover:bg-purple-600 h-7 text-xs">
                        {submitting === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Submit
                      </Button>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${STATUS_STYLES[e.status] || ''}`}>{e.status?.replace(/_/g, ' ').toUpperCase()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmpExpenses;
