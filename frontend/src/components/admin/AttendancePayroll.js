import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, DollarSign, Users, Download, Check, X,
  Loader2, FileText, Calculator, CreditCard, AlertTriangle,
  ChevronLeft, ChevronRight, User, MapPin, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function AttendancePayroll() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Attendance
  const [attendanceReport, setAttendanceReport] = useState(null);
  
  // Payroll
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  
  // Leaves
  const [pendingLeaves, setPendingLeaves] = useState([]);
  
  // Salary Config
  const [salaryConfig, setSalaryConfig] = useState({
    pf_enabled: true,
    pf_percent: 12,
    esi_enabled: true,
    esi_percent: 0.75,
    esi_limit: 21000,
    professional_tax: 200,
    working_days_per_month: 26,
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAttendance(),
        loadPayroll(),
        loadPendingLeaves(),
        loadSalaryConfig()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const response = await api.get('/hr/attendance/report', {
        params: { month: selectedMonth, year: selectedYear }
      });
      setAttendanceReport(response.data);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const loadPayroll = async () => {
    try {
      const response = await api.get('/hr/payroll', {
        params: { month: selectedMonth, year: selectedYear }
      });
      setPayrollRecords(response.data.records || []);
      setPayrollSummary(response.data.summary);
    } catch (error) {
      console.error('Failed to load payroll:', error);
    }
  };

  const loadPendingLeaves = async () => {
    try {
      const response = await api.get('/hr/leave/pending');
      setPendingLeaves(response.data.pending_leaves || []);
    } catch (error) {
      console.error('Failed to load pending leaves:', error);
    }
  };

  const loadSalaryConfig = async () => {
    try {
      const response = await api.get('/hr/salary-config');
      setSalaryConfig(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Failed to load salary config:', error);
    }
  };

  const generatePayroll = async () => {
    setGeneratingPayroll(true);
    try {
      const response = await api.post('/hr/payroll/generate', {
        month: selectedMonth,
        year: selectedYear
      });
      toast.success(response.data.message);
      loadPayroll();
    } catch (error) {
      toast.error('Failed to generate payroll');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const approveLeave = async (leaveId) => {
    try {
      await api.put(`/hr/leave/${leaveId}/approve`);
      toast.success('Leave approved');
      loadPendingLeaves();
    } catch (error) {
      toast.error('Failed to approve leave');
    }
  };

  const rejectLeave = async (leaveId, reason) => {
    try {
      await api.put(`/hr/leave/${leaveId}/reject`, { reason });
      toast.success('Leave rejected');
      loadPendingLeaves();
    } catch (error) {
      toast.error('Failed to reject leave');
    }
  };

  const approvePayroll = async (payrollId) => {
    try {
      await api.put(`/hr/payroll/${payrollId}/approve`);
      toast.success('Payroll approved');
      loadPayroll();
    } catch (error) {
      toast.error('Failed to approve payroll');
    }
  };

  const markPaid = async (payrollId) => {
    try {
      await api.put(`/hr/payroll/${payrollId}/mark-paid`, {
        mode: 'bank_transfer',
        reference: `PAY${Date.now()}`
      });
      toast.success('Marked as paid');
      loadPayroll();
    } catch (error) {
      toast.error('Failed to mark as paid');
    }
  };

  const saveSalaryConfig = async () => {
    try {
      await api.post('/hr/salary-config', salaryConfig);
      toast.success('Salary configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const statusColors = {
    present: 'bg-green-500',
    half_day: 'bg-yellow-500',
    absent: 'bg-red-500',
    on_leave: 'bg-blue-500',
    holiday: 'bg-purple-500',
    wfh: 'bg-cyan-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-400" />
            Attendance & Payroll / हाज़िरी और पेरोल
          </h2>
          <p className="text-slate-400 mt-1">
            Manage employee attendance, leaves, and salary
          </p>
        </div>
        
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(y => y - 1);
              } else {
                setSelectedMonth(m => m - 1);
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-white font-medium px-4">
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(y => y + 1);
              } else {
                setSelectedMonth(m => m + 1);
              }
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
        {[
          { id: 'attendance', label: 'Attendance / हाज़िरी', icon: Calendar },
          { id: 'leaves', label: 'Leave Requests', icon: FileText, badge: pendingLeaves.length },
          { id: 'payroll', label: 'Payroll / पेरोल', icon: CreditCard },
          { id: 'config', label: 'Settings', icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && attendanceReport && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Total Employees</p>
              <p className="text-white text-2xl font-bold">{attendanceReport.summary?.total_employees}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-sm">Avg. Present Days</p>
              <p className="text-green-400 text-2xl font-bold">{attendanceReport.summary?.avg_present_days}</p>
            </div>
          </div>

          {/* Employee List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="text-left p-4 text-slate-400 font-medium">Employee</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Present</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Half Day</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Absent</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceReport.report?.map((emp, idx) => (
                    <tr key={idx} className="border-t border-slate-700">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{emp.employee_name}</p>
                          <p className="text-slate-400 text-xs">{emp.email}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-green-400 font-medium">{emp.present_days}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-yellow-400 font-medium">{emp.half_days}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-red-400 font-medium">{emp.absent_days}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-slate-300">{emp.total_hours}h</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          {pendingLeaves.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Check className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium">No pending leave requests</p>
              <p className="text-slate-400 text-sm">All leave applications have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLeaves.map((leave, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold">{leave.employee_name}</p>
                      <p className="text-slate-400 text-sm capitalize">
                        {leave.leave_type} Leave • {leave.days} day(s)
                      </p>
                      <p className="text-slate-300 text-sm mt-2">
                        {leave.start_date} to {leave.end_date}
                      </p>
                      {leave.reason && (
                        <p className="text-slate-400 text-sm mt-2">
                          Reason: {leave.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveLeave(leave.id)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectLeave(leave.id, 'Not approved')}
                        className="border-red-500 text-red-400 hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              {payrollSummary && (
                <>
                  <div className="bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-700">
                    <p className="text-slate-400 text-xs">Total Gross</p>
                    <p className="text-white font-bold">₹{payrollSummary.total_gross?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-700">
                    <p className="text-slate-400 text-xs">Total Net</p>
                    <p className="text-green-400 font-bold">₹{payrollSummary.total_net?.toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
            <Button
              onClick={generatePayroll}
              disabled={generatingPayroll}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {generatingPayroll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Generate Payroll
            </Button>
          </div>

          {/* Payroll Records */}
          {payrollRecords.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <FileText className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No payroll records</p>
              <p className="text-slate-400 text-sm">Click "Generate Payroll" to create salary slips</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="text-left p-4 text-slate-400 font-medium">Employee</th>
                      <th className="text-center p-4 text-slate-400 font-medium">Working Days</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Gross</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Incentives</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Deductions</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Net Salary</th>
                      <th className="text-center p-4 text-slate-400 font-medium">Status</th>
                      <th className="text-center p-4 text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRecords.map((record, idx) => (
                      <tr key={idx} className="border-t border-slate-700">
                        <td className="p-4">
                          <p className="text-white font-medium">{record.employee_name}</p>
                        </td>
                        <td className="p-4 text-center text-slate-300">
                          {record.effective_working_days} / {record.working_days_in_month}
                        </td>
                        <td className="p-4 text-right text-slate-300">
                          ₹{(record.gross_earnings - record.incentives)?.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-green-400">
                          +₹{record.incentives?.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-red-400">
                          -₹{record.total_deductions?.toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <p className="text-white font-bold">₹{record.net_salary?.toLocaleString()}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            record.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                            record.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {record.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-1 justify-center">
                            {record.status === 'draft' && (
                              <Button size="sm" onClick={() => approvePayroll(record.id)}>
                                Approve
                              </Button>
                            )}
                            {record.status === 'approved' && (
                              <Button size="sm" onClick={() => markPaid(record.id)} className="bg-green-500 hover:bg-green-600">
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Salary Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PF */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Provident Fund (PF)</Label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={salaryConfig.pf_enabled}
                      onChange={(e) => setSalaryConfig(prev => ({ ...prev, pf_enabled: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                {salaryConfig.pf_enabled && (
                  <div>
                    <Label className="text-slate-400 text-sm">Employee Contribution (%)</Label>
                    <Input
                      type="number"
                      value={salaryConfig.pf_percent}
                      onChange={(e) => setSalaryConfig(prev => ({ ...prev, pf_percent: parseFloat(e.target.value) || 0 }))}
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                )}
              </div>

              {/* ESI */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">ESI</Label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={salaryConfig.esi_enabled}
                      onChange={(e) => setSalaryConfig(prev => ({ ...prev, esi_enabled: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
                {salaryConfig.esi_enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-slate-400 text-sm">ESI %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={salaryConfig.esi_percent}
                        onChange={(e) => setSalaryConfig(prev => ({ ...prev, esi_percent: parseFloat(e.target.value) || 0 }))}
                        className="bg-slate-900 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-sm">ESI Limit (₹)</Label>
                      <Input
                        type="number"
                        value={salaryConfig.esi_limit}
                        onChange={(e) => setSalaryConfig(prev => ({ ...prev, esi_limit: parseFloat(e.target.value) || 0 }))}
                        className="bg-slate-900 border-slate-600 text-white mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Professional Tax */}
              <div>
                <Label className="text-slate-300">Professional Tax (₹)</Label>
                <Input
                  type="number"
                  value={salaryConfig.professional_tax}
                  onChange={(e) => setSalaryConfig(prev => ({ ...prev, professional_tax: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>

              {/* Working Days */}
              <div>
                <Label className="text-slate-300">Working Days/Month</Label>
                <Input
                  type="number"
                  value={salaryConfig.working_days_per_month}
                  onChange={(e) => setSalaryConfig(prev => ({ ...prev, working_days_per_month: parseInt(e.target.value) || 26 }))}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
            </div>

            <Button onClick={saveSalaryConfig} className="mt-6 bg-green-500 hover:bg-green-600">
              Save Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendancePayroll;
