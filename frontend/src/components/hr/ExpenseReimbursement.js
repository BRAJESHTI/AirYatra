import React, { useState, useEffect } from 'react';
import { Receipt, Upload, FileText, CheckCircle, XCircle, Clock, Plus, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/apiClient';

const EXPENSE_CATEGORIES = [
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'office_supplies', label: 'Office Supplies' },
  { id: 'client_entertainment', label: 'Client Entertainment' },
  { id: 'training', label: 'Training' },
  { id: 'medical', label: 'Medical' },
  { id: 'communication', label: 'Communication' },
  { id: 'other', label: 'Other' },
];

export default function ExpenseReimbursement({ activeTab, user }) {
  const [expenses, setExpenses] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'travel',
    description: '',
    expense_date: '',
    amount: ''
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [myExpenses, pending] = await Promise.all([
        api.get('/hr/expense/my'),
        api.get('/hr/expense/pending?role=hr')
      ]);
      setExpenses(myExpenses.data.expenses || []);
      setPendingApprovals(pending.data.pending_expenses || []);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async () => {
    try {
      const res = await api.post('/hr/expense/create', {
        ...form,
        amount: parseFloat(form.amount)
      });
      setShowForm(false);
      setForm({ title: '', category: 'travel', description: '', expense_date: '', amount: '' });
      loadData();
      alert(`Expense created: ${res.data.expense_number}`);
    } catch (error) {
      alert('Failed to create expense');
    }
  };

  const uploadDocument = async (expenseId, file) => {
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'receipt');
      await api.post(`/hr/expense/${expenseId}/upload-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadData();
    } catch (error) {
      alert('Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const submitExpense = async (expenseId) => {
    try {
      await api.put(`/hr/expense/${expenseId}/submit`);
      loadData();
      alert('Expense submitted for approval');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit');
    }
  };

  const approveExpense = async (expenseId, role) => {
    try {
      await api.put(`/hr/expense/${expenseId}/approve`, { role, comments: '' });
      loadData();
      alert('Expense approved');
    } catch (error) {
      alert('Failed to approve');
    }
  };

  const rejectExpense = async (expenseId, role) => {
    const reason = prompt('Rejection reason');
    if (!reason) return;
    try {
      await api.put(`/hr/expense/${expenseId}/reject`, { role, reason });
      loadData();
      alert('Expense rejected');
    } catch (error) {
      alert('Failed to reject');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400',
      hr_pending: 'bg-yellow-500/20 text-yellow-400',
      finance_pending: 'bg-blue-500/20 text-blue-400',
      admin_pending: 'bg-purple-500/20 text-purple-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      hr_rejected: 'bg-red-500/20 text-red-400',
      finance_rejected: 'bg-red-500/20 text-red-400',
      admin_rejected: 'bg-red-500/20 text-red-400',
      added_to_salary: 'bg-emerald-500/20 text-emerald-400',
      paid: 'bg-green-500/20 text-green-400'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-white">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Expense Reimbursement</h2>
          <p className="text-slate-400">Submit and track expense claims with document attachments</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-500 hover:bg-green-600">
          <Plus className="h-4 w-4 mr-2" /> New Claim</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-white">{expenses.filter(e => e.status === 'draft').length}</p>
            <p className="text-slate-400 text-sm">Draft</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-yellow-400">{expenses.filter(e => e.status.includes('pending')).length}</p>
            <p className="text-slate-400 text-sm">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/50">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-green-400">{expenses.filter(e => e.status === 'approved').length}</p>
            <p className="text-slate-400 text-sm">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/50">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-emerald-400">₹{expenses.filter(e => e.status === 'approved' || e.status === 'added_to_salary').reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</p>
            <p className="text-slate-400 text-sm">Total Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Expense Form */}
      {showForm && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">New Expense Claim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Title*</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="e.g., Client meeting travel"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Category*</Label>
                <select
                  className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                  value={form.category}
                  onChange={(e) => setForm({...form, category: e.target.value})}
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Amount (₹)*</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="1500"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Expense Date*</Label>
                <Input
                  type="date"
                  className="bg-slate-700 border-slate-600 text-white"
                  value={form.expense_date}
                  onChange={(e) => setForm({...form, expense_date: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <textarea
                className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                rows={3}
                placeholder="Describe the expense..."
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createExpense} className="bg-green-500 hover:bg-green-600">
                Create Claim</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-slate-500 text-sm">Note: After creating, upload documents and submit for approval</p>
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals (HR/Finance/Admin view) */}
      {activeTab === 'pending_approvals' && pendingApprovals.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Pending Approvals{pendingApprovals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((expense) => (
                <div key={expense.id} className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{expense.expense_number}</p>
                      <p className="text-slate-400 text-sm">{expense.employee_name} • {expense.title}</p>
                      <p className="text-slate-400 text-sm">{expense.category} • {expense.expense_date}</p>
                      <p className="text-lg font-bold text-orange-400 mt-1">₹{expense.amount.toLocaleString()}</p>
                      {expense.documents?.length > 0 && (
                        <p className="text-green-400 text-sm mt-1">📎 {expense.documents.length} document(s) attached</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveExpense(expense.id, 'hr')} className="bg-green-500">
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectExpense(expense.id, 'hr')}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Expenses List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">My Expense Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expenses.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No expense claims yet</p>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{expense.expense_number}</p>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(expense.status)}`}>
                          {expense.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-300">{expense.title}</p>
                      <p className="text-slate-400 text-sm">{expense.category} • {expense.expense_date}</p>
                      <p className="text-lg font-bold text-orange-400 mt-1">₹{expense.amount.toLocaleString()}</p>
                      
                      {/* Documents */}
                      <div className="mt-2">
                        {expense.documents?.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                            {expense.documents.map((doc, idx) => (
                              <a key={idx} href={doc.url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center">
                                <FileText className="h-3 w-3 mr-1" /> {doc.filename}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-yellow-400 text-sm">⚠️ No documents attached</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {expense.status === 'draft' && (
                        <>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => e.target.files?.[0] && uploadDocument(expense.id, e.target.files[0])}
                            />
                            <span className="inline-flex items-center px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                              <Upload className="h-3 w-3 mr-1" /> Upload Doc
                            </span>
                          </label>
                          <Button size="sm" onClick={() => submitExpense(expense.id)} className="bg-green-500" disabled={!expense.documents?.length}>
                            Submit for Approval
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Approval Flow */}
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    {expense.approval_flow?.map((step, idx) => (
                      <div key={idx} className="flex items-center">
                        {step.status === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-400 mr-1" />
                        ) : step.status === 'pending' ? (
                          <Clock className="h-4 w-4 text-yellow-400 mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 mr-1" />
                        )}
                        <span className="text-slate-400 capitalize">{step.role}</span>
                        {idx < expense.approval_flow.length - 1 && <span className="ml-2 text-slate-600">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
