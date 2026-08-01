import React, { useState, useEffect } from 'react';
import { LogOut, Plane, LayoutDashboard, Clock, CalendarDays, FileText, Receipt, BadgeIndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../services/api';
import EmpAttendance from '../components/employee/EmpAttendance';
import EmpLeave from '../components/employee/EmpLeave';
import EmpPayslips from '../components/employee/EmpPayslips';
import EmpExpenses from '../components/employee/EmpExpenses';

const TABS = [
  { id: 'overview', label: 'Overview / ओवरव्यू', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance / उपस्थिति', icon: Clock },
  { id: 'leave', label: 'Leave / छुट्टी', icon: CalendarDays },
  { id: 'payslips', label: 'Payslips / वेतन पर्ची', icon: FileText },
  { id: 'expenses', label: 'Expenses / खर्च', icon: Receipt },
];

function Overview({ overview, goTo }) {
  if (!overview) return <div className="text-slate-400">Loading...</div>;
  const { employee, today_attendance, month_summary, leave_balance, expenses, latest_payslip, gross_salary } = overview;
  const leaveLeft =
    (leave_balance.casual - (leave_balance.casual_used || 0)) +
    (leave_balance.sick - (leave_balance.sick_used || 0)) +
    (leave_balance.earned - (leave_balance.earned_used || 0));
  return (
    <div className="space-y-6" data-testid="employee-overview">
      <div>
        <h1 className="text-2xl font-bold text-white">Namaste, {employee.name} 👋</h1>
        <p className="text-slate-400 text-sm">
          {employee.employee_code || ''} {employee.designation ? `• ${employee.designation}` : ''} {employee.department ? `• ${employee.department}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => goTo('attendance')} className="bg-sky-500/15 rounded-xl p-5 border border-sky-500/40 text-left hover:bg-sky-500/25 transition-colors" data-testid="overview-attendance-card">
          <Clock className="h-5 w-5 text-sky-400 mb-2" />
          <p className="text-xl font-bold text-white">{today_attendance ? (today_attendance.check_out_time ? 'Checked Out' : 'Checked In') : 'Not Marked'}</p>
          <p className="text-slate-400 text-sm">Today / आज • {month_summary.present_days} days this month</p>
        </button>
        <button onClick={() => goTo('leave')} className="bg-green-500/15 rounded-xl p-5 border border-green-500/40 text-left hover:bg-green-500/25 transition-colors" data-testid="overview-leave-card">
          <CalendarDays className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-xl font-bold text-white">{leaveLeft} days</p>
          <p className="text-slate-400 text-sm">Leave Balance / शेष छुट्टी</p>
        </button>
        <button onClick={() => goTo('payslips')} className="bg-orange-500/15 rounded-xl p-5 border border-orange-500/40 text-left hover:bg-orange-500/25 transition-colors" data-testid="overview-payslip-card">
          <BadgeIndianRupee className="h-5 w-5 text-orange-400 mb-2" />
          <p className="text-xl font-bold text-white">{latest_payslip ? `₹${latest_payslip.net_salary?.toLocaleString()}` : gross_salary ? `₹${gross_salary.toLocaleString()}` : '—'}</p>
          <p className="text-slate-400 text-sm">{latest_payslip ? `${latest_payslip.period} • ${latest_payslip.status}` : 'Gross Salary / मासिक वेतन'}</p>
        </button>
        <button onClick={() => goTo('expenses')} className="bg-purple-500/15 rounded-xl p-5 border border-purple-500/40 text-left hover:bg-purple-500/25 transition-colors" data-testid="overview-expense-card">
          <Receipt className="h-5 w-5 text-purple-400 mb-2" />
          <p className="text-xl font-bold text-white">₹{expenses.pending_amount?.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Pending Claims / लंबित क्लेम ({expenses.total_claims})</p>
        </button>
      </div>
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <h3 className="text-white font-semibold mb-3">This Month / इस महीने</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-bold text-sky-400">{month_summary.present_days}</p><p className="text-slate-400 text-xs">Present Days</p></div>
          <div><p className="text-2xl font-bold text-yellow-400">{month_summary.half_days}</p><p className="text-slate-400 text-xs">Half Days</p></div>
          <div><p className="text-2xl font-bold text-green-400">{month_summary.total_hours}h</p><p className="text-slate-400 text-xs">Total Hours</p></div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeePortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);

  const loadOverview = async () => {
    try {
      const res = await api.get('/hr/employee/overview');
      setOverview(res.data);
    } catch (e) { /* silent */ }
  };

  useEffect(() => { loadOverview(); }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'attendance': return <EmpAttendance onChanged={loadOverview} />;
      case 'leave': return <EmpLeave onChanged={loadOverview} />;
      case 'payslips': return <EmpPayslips />;
      case 'expenses': return <EmpExpenses onChanged={loadOverview} />;
      default: return <Overview overview={overview} goTo={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="employee-portal">
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-full mx-auto pl-64 pr-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-sky-500" />
            <span className="text-2xl font-bold text-white">AirYatra <span className="text-sky-400">People</span></span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300 hidden sm:inline">{user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-sky-400" data-testid="employee-logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 sticky top-[73px] h-[calc(100vh-73px)] hidden md:block">
          <nav className="p-3 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`employee-nav-${tab.id}`}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    activeTab === tab.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="md:hidden flex gap-2 mb-4 overflow-x-auto pb-2">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {tab.label.split(' / ')[0]}
              </button>
            ))}
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
