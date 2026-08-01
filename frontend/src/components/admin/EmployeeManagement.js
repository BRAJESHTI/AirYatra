import React, { useState, useEffect } from 'react';
import { Users, Plus, Loader2, BadgeIndianRupee, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const ROLES = ['employee', 'hr', 'sales', 'finance', 'support', 'marketing', 'operations'];
const SALARY_FIELDS = [
  ['basic_salary', 'Basic Salary'], ['hra', 'HRA'], ['conveyance', 'Conveyance'],
  ['medical_allowance', 'Medical'], ['special_allowance', 'Special'], ['other_allowances', 'Other'],
];
const EMPTY_FORM = {
  full_name: '', email: '', password: '', phone: '', role: 'employee',
  department: '', designation: '', joining_date: '',
  basic_salary: '', hra: '', conveyance: '', medical_allowance: '', special_allowance: '', other_allowances: '',
};

function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salaryDialog, setSalaryDialog] = useState(null);
  const [salaryForm, setSalaryForm] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/employees');
      setEmployees(res.data.employees);
    } catch (e) { toast.error('Failed to load employees'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    if (!form.full_name || !form.email || !form.password) return toast.error('Name, email, password required hai');
    if (form.password.length < 8) return toast.error('Password kam se kam 8 characters ka ho');
    setSaving(true);
    try {
      const res = await api.post('/hr/employees', form);
      toast.success(res.data.message);
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create employee');
    } finally { setSaving(false); }
  };

  const toggleActive = async (emp) => {
    try {
      await api.put(`/hr/employees/${emp.id}`, { is_active: !(emp.is_active !== false) });
      toast.success(emp.is_active !== false ? 'Employee deactivated' : 'Employee activated');
      await load();
    } catch (e) { toast.error('Failed to update'); }
  };

  const saveSalary = async () => {
    setSaving(true);
    try {
      await api.post('/hr/employee-salary', {
        employee_id: salaryDialog.id,
        ...Object.fromEntries(SALARY_FIELDS.map(([k]) => [k, Number(salaryForm[k] || 0)])),
      });
      toast.success('Salary structure updated / वेतन संरचना सेट');
      setSalaryDialog(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to set salary');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="employee-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employee Management / कर्मचारी प्रबंधन</h1>
          <p className="text-slate-400 text-sm">{employees.length} staff members • Employees login at /employee</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-green-500 hover:bg-green-600" data-testid="add-employee-btn">
          <Plus className="h-4 w-4 mr-2" />Add Employee / नया कर्मचारी
        </Button>
      </div>

      {loading ? (
        <div className="text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 text-slate-400">Employee</th>
                <th className="text-left p-3 text-slate-400">Role / Dept</th>
                <th className="text-center p-3 text-slate-400">Today</th>
                <th className="text-right p-3 text-slate-400">Gross Salary</th>
                <th className="text-center p-3 text-slate-400">Status</th>
                <th className="text-center p-3 text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t border-slate-700/60" data-testid={`employee-row-${emp.id}`}>
                  <td className="p-3">
                    <p className="text-white font-medium">{emp.full_name}</p>
                    <p className="text-slate-500 text-xs">{emp.employee_code ? `${emp.employee_code} • ` : ''}{emp.email}</p>
                  </td>
                  <td className="p-3">
                    <p className="text-slate-300 capitalize">{(emp.roles || []).join(', ')}</p>
                    <p className="text-slate-500 text-xs">{emp.department || '—'} {emp.designation ? `• ${emp.designation}` : ''}</p>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      emp.today_status === 'present' ? 'bg-green-500/20 text-green-400' :
                      emp.today_status === 'on_leave' ? 'bg-blue-500/20 text-blue-400' :
                      emp.today_status === 'not_marked' ? 'bg-slate-500/20 text-slate-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{emp.today_status?.replace('_', ' ').toUpperCase()}</span>
                  </td>
                  <td className="p-3 text-right text-white">{emp.gross_salary ? `₹${emp.gross_salary.toLocaleString()}` : <span className="text-slate-500">Not set</span>}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${emp.is_active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {emp.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-300 hover:text-white"
                        onClick={() => { setSalaryDialog(emp); setSalaryForm({}); }} data-testid={`set-salary-${emp.id}`}>
                        <BadgeIndianRupee className="h-3 w-3 mr-1" />Salary
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(emp)} data-testid={`toggle-active-${emp.id}`}
                        className={`h-7 text-xs border-slate-600 ${emp.is_active !== false ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                        <Power className="h-3 w-3 mr-1" />{emp.is_active !== false ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400"><Users className="h-10 w-10 mx-auto mb-2 text-slate-600" />No employees yet. Add your first employee.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Employee Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Employee / नया कर्मचारी जोड़ें</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-300">Full Name *</Label><Input value={form.full_name} onChange={set('full_name')} className="bg-slate-800 border-slate-700 mt-1" data-testid="emp-name-input" /></div>
              <div><Label className="text-slate-300">Email *</Label><Input type="email" value={form.email} onChange={set('email')} className="bg-slate-800 border-slate-700 mt-1" data-testid="emp-email-input" /></div>
              <div><Label className="text-slate-300">Password *</Label><Input type="text" value={form.password} onChange={set('password')} placeholder="Min 8 characters" className="bg-slate-800 border-slate-700 mt-1" data-testid="emp-password-input" /></div>
              <div><Label className="text-slate-300">Phone</Label><Input value={form.phone} onChange={set('phone')} className="bg-slate-800 border-slate-700 mt-1" /></div>
              <div>
                <Label className="text-slate-300">Role</Label>
                <select value={form.role} onChange={set('role')} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="emp-role-select">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><Label className="text-slate-300">Joining Date</Label><Input type="date" value={form.joining_date} onChange={set('joining_date')} className="bg-slate-800 border-slate-700 mt-1" /></div>
              <div><Label className="text-slate-300">Department</Label><Input value={form.department} onChange={set('department')} placeholder="e.g. Operations" className="bg-slate-800 border-slate-700 mt-1" data-testid="emp-department-input" /></div>
              <div><Label className="text-slate-300">Designation</Label><Input value={form.designation} onChange={set('designation')} placeholder="e.g. Flight Coordinator" className="bg-slate-800 border-slate-700 mt-1" /></div>
            </div>
            <div>
              <p className="text-orange-400 font-semibold text-sm mb-2">Salary Structure (Monthly ₹) — optional</p>
              <div className="grid grid-cols-3 gap-3">
                {SALARY_FIELDS.map(([k, label]) => (
                  <div key={k}><Label className="text-slate-400 text-xs">{label}</Label><Input type="number" value={form[k]} onChange={set(k)} className="bg-slate-800 border-slate-700 mt-1" data-testid={`emp-${k}-input`} /></div>
                ))}
              </div>
            </div>
            <Button onClick={create} disabled={saving} className="w-full bg-green-500 hover:bg-green-600" data-testid="create-employee-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Employee / कर्मचारी बनाएं
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Salary Dialog */}
      <Dialog open={!!salaryDialog} onOpenChange={(v) => !v && setSalaryDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader><DialogTitle>Set Salary — {salaryDialog?.full_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {SALARY_FIELDS.map(([k, label]) => (
              <div key={k}><Label className="text-slate-400 text-xs">{label} (₹)</Label>
                <Input type="number" value={salaryForm[k] || ''} onChange={(e) => setSalaryForm({ ...salaryForm, [k]: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid={`salary-${k}-input`} />
              </div>
            ))}
          </div>
          <Button onClick={saveSalary} disabled={saving} className="w-full bg-orange-500 hover:bg-orange-600 mt-2" data-testid="save-salary-btn">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Salary Structure
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmployeeManagement;
