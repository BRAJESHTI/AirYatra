import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import GlobalSearch from '../components/shared/GlobalSearch';
import {
  Building2, Users, CreditCard, TrendingUp, Plus, Search,
  CheckCircle, Clock, XCircle, BarChart3, Wallet, FileText,
  UserPlus, Settings, Loader2, Download, Plane, UserX, UserCheck
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusBadge = (status) => {
  const map = {
    confirmed: 'bg-green-500/20 text-green-400 border border-green-500/30',
    pending_approval: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };
  const label = { confirmed: 'Confirmed', pending_approval: 'Pending Approval', rejected: 'Rejected' };
  return <Badge className={map[status] || 'bg-slate-600'}>{label[status] || status}</Badge>;
};

const CorporateDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [corporate, setCorporate] = useState(null);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [savingThreshold, setSavingThreshold] = useState(false);

  const saveAlertThreshold = async () => {
    const val = parseFloat(alertThreshold);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid threshold amount');
      return;
    }
    setSavingThreshold(true);
    try {
      const res = await fetch(`${API_URL}/api/corporate/credit-alert-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ threshold_amount: val }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      toast.success(`Low credit alert limit set: ₹${val.toLocaleString()}`);
      setCorporate((c) => ({ ...c, credit_alert_threshold: val }));
    } catch (e) {
      toast.error(e.message || 'Threshold save failed');
    } finally {
      setSavingThreshold(false);
    }
  };
  const [employeeCode, setEmployeeCode] = useState('CORP-ADMIN');
  const [corpRole, setCorpRole] = useState('admin');
  const [employees, setEmployees] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);
  const [empSearch, setEmpSearch] = useState('');

  const [newEmployee, setNewEmployee] = useState({
    name: '', email: '', phone: '', department: '', designation: '', role: 'traveler',
    travel_budget: 100000, requires_approval: true, approval_limit: 50000
  });

  const [newBooking, setNewBooking] = useState({
    employee_code: '', from_location: '', to_location: '', travel_date: '',
    travel_time: '09:00', passengers: 1, purpose: '', urgency: 'normal', estimated_amount: ''
  });

  const [registerForm, setRegisterForm] = useState({
    company_name: '', registration_number: '', gst_number: '', industry: '',
    company_size: '1-50', address: '', city: '', state: '', pincode: '',
    primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '',
    admin_email: user?.email || '', admin_name: user?.full_name || ''
  });

  const getToken = () => localStorage.getItem('token') || localStorage.getItem('access_token');

  const fetchAll = useCallback(async (corporateId) => {
    try {
      const [empRes, approvalRes, budgetRes, analyticsRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/api/corporate/employees/${corporateId}?active_only=false`),
        fetch(`${API_URL}/api/corporate/approvals/pending/${corporateId}`),
        fetch(`${API_URL}/api/corporate/budget/${corporateId}`),
        fetch(`${API_URL}/api/corporate/analytics/${corporateId}?period=monthly`),
        fetch(`${API_URL}/api/corporate/bookings/${corporateId}`)
      ]);
      const [empData, approvalData, budgetData, analyticsData, bookingsData] = await Promise.all([
        empRes.json(), approvalRes.json(), budgetRes.json(), analyticsRes.json(), bookingsRes.json()
      ]);
      if (empData.success) setEmployees(empData.employees);
      if (approvalData.success) setPendingApprovals(approvalData.approvals);
      if (budgetData.success) setBudgets(budgetData.budgets);
      if (analyticsData.success) setAnalytics(analyticsData.analytics);
      if (bookingsData.success) setBookings(bookingsData.bookings);
    } catch (error) {
      console.error('Error fetching corporate data:', error);
    }
  }, []);

  const resolveAccount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/corporate/my-account`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.corporate) {
        setCorporate(data.corporate);
        setEmployeeCode(data.employee_code || 'CORP-ADMIN');
        setCorpRole(data.corp_role || 'admin');
        await fetchAll(data.corporate.corporate_id);
      }
    } catch (error) {
      console.error('Error resolving corporate account:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => { resolveAccount(); }, [resolveAccount]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/corporate/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Corporate account registration submitted! Pending admin approval.');
        setShowRegister(false);
        resolveAccount();
      } else {
        toast.error(data.detail || 'Registration failed');
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/corporate/employee/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEmployee, corporate_id: corporate.corporate_id })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Employee ${newEmployee.name} added successfully!`);
        setShowAddEmployee(false);
        setNewEmployee({
          name: '', email: '', phone: '', department: '', designation: '', role: 'traveler',
          travel_budget: 100000, requires_approval: true, approval_limit: 50000
        });
        fetchAll(corporate.corporate_id);
      } else {
        toast.error(data.detail || 'Failed to add employee');
      }
    } catch (error) {
      toast.error('Failed to add employee');
    }
  };

  const handleToggleEmployee = async (emp) => {
    try {
      let response;
      if (emp.is_active) {
        response = await fetch(`${API_URL}/api/corporate/employee/${emp.employee_code}`, { method: 'DELETE' });
      } else {
        response = await fetch(`${API_URL}/api/corporate/employee/${emp.employee_code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true })
        });
      }
      const data = await response.json();
      if (data.success) {
        toast.success(emp.is_active ? `${emp.name} deactivated` : `${emp.name} activated`);
        fetchAll(corporate.corporate_id);
      } else {
        toast.error(data.detail || 'Action failed');
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setSubmittingBooking(true);
    try {
      const response = await fetch(`${API_URL}/api/corporate/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBooking,
          corporate_id: corporate.corporate_id,
          passengers: Number(newBooking.passengers),
          estimated_amount: Number(newBooking.estimated_amount)
        })
      });
      const data = await response.json();
      if (data.success) {
        if (data.auto_approved) {
          toast.success(`Booking ${data.booking.booking_number} auto-approved and confirmed!`);
        } else {
          toast.info(`Booking ${data.booking.booking_number} sent for approval`);
        }
        setShowNewBooking(false);
        setNewBooking({
          employee_code: '', from_location: '', to_location: '', travel_date: '',
          travel_time: '09:00', passengers: 1, purpose: '', urgency: 'normal', estimated_amount: ''
        });
        fetchAll(corporate.corporate_id);
      } else {
        toast.error(data.detail || 'Failed to create booking');
      }
    } catch (error) {
      toast.error('Failed to create booking');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleApprovalAction = async (approvalId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/corporate/approvals/action?approver_id=${employeeCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(action === 'approve' ? 'Booking approved!' : 'Booking rejected');
        fetchAll(corporate.corporate_id);
      } else {
        toast.error(data.detail || 'Action failed');
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const downloadGSTInvoice = async (booking) => {
    setDownloadingInvoice(booking.id);
    try {
      const res = await fetch(`${API_URL}/api/corporate/invoice/${booking.id}/gst?corporate_id=${corporate.corporate_id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to generate invoice');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AirYatra_GST_Invoice_${booking.booking_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('GST Invoice downloaded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const canApprove = ['admin', 'manager', 'approver'].includes(corpRole);
  const activeEmployees = employees.filter(e => e.is_active);
  const filteredEmployees = employees.filter(e =>
    !empSearch ||
    e.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.email?.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.department?.toLowerCase().includes(empSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Registration flow when no corporate account is linked
  if (!corporate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Building2 className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Corporate Travel Console</h1>
            <p className="text-slate-400">Centralized travel management for your organization</p>
          </div>

          {!showRegister ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold text-white mb-4">No Corporate Account Found</h2>
                <p className="text-slate-400 mb-6">Register your company to access corporate travel features</p>
                <Button
                  data-testid="register-corporate-btn"
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => setShowRegister(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Register Corporate Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Corporate Registration</CardTitle>
                <CardDescription>Fill in your company details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">Company Name *</label>
                      <Input
                        data-testid="company-name-input"
                        value={registerForm.company_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, company_name: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Registration Number *</label>
                      <Input
                        value={registerForm.registration_number}
                        onChange={(e) => setRegisterForm({ ...registerForm, registration_number: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">GST Number *</label>
                      <Input
                        value={registerForm.gst_number}
                        onChange={(e) => setRegisterForm({ ...registerForm, gst_number: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Industry *</label>
                      <Input
                        value={registerForm.industry}
                        onChange={(e) => setRegisterForm({ ...registerForm, industry: e.target.value })}
                        placeholder="e.g., Technology, Manufacturing"
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Company Size *</label>
                      <select
                        value={registerForm.company_size}
                        onChange={(e) => setRegisterForm({ ...registerForm, company_size: e.target.value })}
                        className="w-full h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                      >
                        <option value="1-50">1-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="201-500">201-500 employees</option>
                        <option value="500+">500+ employees</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Primary Contact Name *</label>
                      <Input
                        value={registerForm.primary_contact_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, primary_contact_name: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Primary Contact Email *</label>
                      <Input
                        type="email"
                        value={registerForm.primary_contact_email}
                        onChange={(e) => setRegisterForm({ ...registerForm, primary_contact_email: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Primary Contact Phone *</label>
                      <Input
                        value={registerForm.primary_contact_phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, primary_contact_phone: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">Address *</label>
                    <Input
                      value={registerForm.address}
                      onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">City *</label>
                      <Input
                        value={registerForm.city}
                        onChange={(e) => setRegisterForm({ ...registerForm, city: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">State *</label>
                      <Input
                        value={registerForm.state}
                        onChange={(e) => setRegisterForm({ ...registerForm, state: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Pincode *</label>
                      <Input
                        value={registerForm.pincode}
                        onChange={(e) => setRegisterForm({ ...registerForm, pincode: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setShowRegister(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="submit-registration-btn" className="flex-1 bg-orange-500 hover:bg-orange-600">
                      Submit Registration
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <GlobalSearch user={user} />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white" data-testid="corporate-company-name">{corporate?.company_name || 'Corporate Dashboard'}</h1>
            <p className="text-slate-400">GSTIN: {corporate?.gst_number} • Manage your corporate travel</p>
          </div>
          <Badge className={corporate?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}>
            {corporate?.status?.toUpperCase() || 'PENDING'}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {['overview', 'bookings', 'employees', 'approvals', 'budgets', 'analytics'].map((tab) => (
            <Button
              key={tab}
              data-testid={`tab-${tab}`}
              variant={activeTab === tab ? 'default' : 'outline'}
              className={activeTab === tab ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'approvals' && pendingApprovals.length > 0 && (
                <span className="ml-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Active Employees</p>
                      <p className="text-3xl font-bold text-white" data-testid="stat-employees">{activeEmployees.length}</p>
                    </div>
                    <Users className="h-10 w-10 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Credit Available</p>
                      <p className="text-3xl font-bold text-white">{formatCurrency(corporate?.credit_available)}</p>
                    </div>
                    <CreditCard className="h-10 w-10 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Total Bookings</p>
                      <p className="text-3xl font-bold text-white" data-testid="stat-bookings">{bookings.length}</p>
                    </div>
                    <FileText className="h-10 w-10 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Pending Approvals</p>
                      <p className="text-3xl font-bold text-white" data-testid="stat-approvals">{pendingApprovals.length}</p>
                    </div>
                    <Clock className="h-10 w-10 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    data-testid="quick-new-booking"
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => { setActiveTab('bookings'); setShowNewBooking(true); }}
                  >
                    <Plane className="h-4 w-4 mr-3" /> New Booking Request
                  </Button>
                  <Button
                    data-testid="quick-add-employee"
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => { setActiveTab('employees'); setShowAddEmployee(true); }}
                  >
                    <UserPlus className="h-4 w-4 mr-3" /> Add New Employee
                  </Button>
                  <Button
                    data-testid="quick-review-approvals"
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => setActiveTab('approvals')}
                  >
                    <CheckCircle className="h-4 w-4 mr-3" /> Review Approvals ({pendingApprovals.length})
                  </Button>
                  <Button
                    data-testid="quick-view-bookings"
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => setActiveTab('bookings')}
                  >
                    <Download className="h-4 w-4 mr-3" /> Download GST Invoices
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Credit Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Credit Limit</span>
                      <span className="text-white font-semibold">{formatCurrency(corporate?.credit_limit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Credit Used</span>
                      <span className="text-red-400 font-semibold">{formatCurrency(corporate?.credit_used)}</span>
                    </div>
                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                        style={{ width: `${(corporate?.credit_available / corporate?.credit_limit) * 100 || 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                      <span className="text-slate-300 font-medium">Available</span>
                      <span className="text-green-400 font-bold text-lg">{formatCurrency(corporate?.credit_available)}</span>
                    </div>

                    {/* Low Credit Alert Threshold */}
                    <div className="pt-3 border-t border-slate-700" data-testid="credit-alert-setting">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-300 text-sm font-medium">⚠️ Low Credit Alert Limit</span>
                        {corporate?.credit_alert_threshold > 0 && (
                          <span className="text-[11px] text-yellow-400" data-testid="current-alert-threshold">
                            Current: {formatCurrency(corporate.credit_alert_threshold)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mb-2">Available credit isse neeche girte hi admin ko email alert jayega. (Default: credit limit ka 20%)</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder={String(corporate?.credit_alert_threshold || Math.round((corporate?.credit_limit || 0) * 0.2))}
                          value={alertThreshold}
                          onChange={(e) => setAlertThreshold(e.target.value)}
                          className="bg-slate-900 border-slate-600 h-9 text-white"
                          data-testid="alert-threshold-input"
                        />
                        <Button
                          size="sm"
                          onClick={saveAlertThreshold}
                          disabled={savingThreshold || !alertThreshold}
                          className="bg-orange-500 hover:bg-orange-600 h-9"
                          data-testid="save-alert-threshold-btn"
                        >
                          {savingThreshold ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Plane className="h-5 w-5 text-orange-400" /> Employee Bookings
              </h2>
              <Button
                data-testid="new-booking-btn"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setShowNewBooking(!showNewBooking)}
              >
                <Plus className="h-4 w-4 mr-2" /> New Booking Request
              </Button>
            </div>

            {/* New Booking Form */}
            {showNewBooking && (
              <Card className="bg-slate-800/50 border-orange-500/50">
                <CardHeader>
                  <CardTitle className="text-white">New Booking Request</CardTitle>
                  <CardDescription>
                    Bookings within the auto-approve limit or employee approval limit are confirmed instantly; others go for approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateBooking} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Employee *</label>
                        <select
                          data-testid="booking-employee-select"
                          value={newBooking.employee_code}
                          onChange={(e) => setNewBooking({ ...newBooking, employee_code: e.target.value })}
                          className="w-full h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                          required
                        >
                          <option value="">Select employee</option>
                          {activeEmployees.map(emp => (
                            <option key={emp.employee_code} value={emp.employee_code}>
                              {emp.name} ({emp.department})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">From *</label>
                        <Input
                          data-testid="booking-from-input"
                          placeholder="e.g., Mumbai"
                          value={newBooking.from_location}
                          onChange={(e) => setNewBooking({ ...newBooking, from_location: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">To *</label>
                        <Input
                          data-testid="booking-to-input"
                          placeholder="e.g., Delhi"
                          value={newBooking.to_location}
                          onChange={(e) => setNewBooking({ ...newBooking, to_location: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Travel Date *</label>
                        <Input
                          data-testid="booking-date-input"
                          type="date"
                          value={newBooking.travel_date}
                          onChange={(e) => setNewBooking({ ...newBooking, travel_date: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Time</label>
                        <Input
                          type="time"
                          value={newBooking.travel_time}
                          onChange={(e) => setNewBooking({ ...newBooking, travel_time: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Passengers *</label>
                        <Input
                          type="number"
                          min={1}
                          max={19}
                          value={newBooking.passengers}
                          onChange={(e) => setNewBooking({ ...newBooking, passengers: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Estimated Amount (₹) *</label>
                        <Input
                          data-testid="booking-amount-input"
                          type="number"
                          min={1}
                          placeholder="e.g., 85000"
                          value={newBooking.estimated_amount}
                          onChange={(e) => setNewBooking({ ...newBooking, estimated_amount: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Urgency</label>
                        <select
                          value={newBooking.urgency}
                          onChange={(e) => setNewBooking({ ...newBooking, urgency: e.target.value })}
                          className="w-full h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                        >
                          <option value="normal">Normal</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">Purpose *</label>
                        <Input
                          data-testid="booking-purpose-input"
                          placeholder="e.g., Client meeting"
                          value={newBooking.purpose}
                          onChange={(e) => setNewBooking({ ...newBooking, purpose: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setShowNewBooking(false)}>Cancel</Button>
                      <Button type="submit" data-testid="submit-booking-btn" disabled={submittingBooking} className="bg-orange-500 hover:bg-orange-600">
                        {submittingBooking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plane className="h-4 w-4 mr-2" />}
                        Submit Booking
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Bookings Table */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="bookings-table">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left text-slate-400 p-4 font-medium">Booking #</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Employee</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Route</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Date</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Amount</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Status</th>
                        <th className="text-left text-slate-400 p-4 font-medium">GST Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-t border-slate-700/50 hover:bg-slate-700/30" data-testid={`booking-row-${b.booking_number}`}>
                          <td className="p-4 text-orange-400 font-mono text-sm">{b.booking_number}</td>
                          <td className="p-4">
                            <p className="text-white font-medium">{b.employee_name}</p>
                            <p className="text-slate-400 text-xs">{b.department}</p>
                          </td>
                          <td className="p-4 text-slate-300">{b.from_location} → {b.to_location}</td>
                          <td className="p-4 text-slate-300">{b.travel_date}</td>
                          <td className="p-4 text-white font-semibold">{formatCurrency(b.final_price)}</td>
                          <td className="p-4">{statusBadge(b.status)}</td>
                          <td className="p-4">
                            {b.status === 'confirmed' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`gst-invoice-btn-${b.booking_number}`}
                                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                                disabled={downloadingInvoice === b.id}
                                onClick={() => downloadGSTInvoice(b)}
                              >
                                {downloadingInvoice === b.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <><Download className="h-4 w-4 mr-1" /> GST PDF</>}
                              </Button>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {bookings.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No bookings yet. Create your first booking request.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  data-testid="employee-search-input"
                  placeholder="Search employees..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <Button
                data-testid="add-employee-btn"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setShowAddEmployee(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Employee
              </Button>
            </div>

            {showAddEmployee && (
              <Card className="bg-slate-800/50 border-orange-500/50">
                <CardHeader>
                  <CardTitle className="text-white">Add New Employee</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        data-testid="employee-name-input"
                        placeholder="Full Name"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input
                        data-testid="employee-email-input"
                        type="email"
                        placeholder="Email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input
                        placeholder="Phone"
                        value={newEmployee.phone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input
                        placeholder="Department"
                        value={newEmployee.department}
                        onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input
                        placeholder="Designation"
                        value={newEmployee.designation}
                        onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <select
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                        className="h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                      >
                        <option value="traveler">Traveler</option>
                        <option value="booker">Booker</option>
                        <option value="approver">Approver</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <div>
                        <label className="text-xs text-slate-400">Travel Budget (₹)</label>
                        <Input
                          type="number"
                          value={newEmployee.travel_budget}
                          onChange={(e) => setNewEmployee({ ...newEmployee, travel_budget: Number(e.target.value) })}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Auto-Approval Limit (₹)</label>
                        <Input
                          type="number"
                          value={newEmployee.approval_limit}
                          onChange={(e) => setNewEmployee({ ...newEmployee, approval_limit: Number(e.target.value) })}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setShowAddEmployee(false)}>Cancel</Button>
                      <Button type="submit" data-testid="submit-employee-btn" className="bg-orange-500">Add Employee</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="employees-table">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left text-slate-400 p-4 font-medium">Employee</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Department</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Role</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Budget</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Status</th>
                        <th className="text-left text-slate-400 p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.employee_code} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-4">
                            <div>
                              <p className="text-white font-medium">{emp.name}</p>
                              <p className="text-slate-400 text-sm">{emp.email}</p>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300">{emp.department}</td>
                          <td className="p-4">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {emp.role}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="text-white">{formatCurrency(emp.budget_remaining ?? (emp.travel_budget - emp.budget_used))}</p>
                              <p className="text-slate-400 text-xs">of {formatCurrency(emp.travel_budget)}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={emp.is_active ? 'bg-green-500' : 'bg-red-500'}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`toggle-employee-${emp.employee_code}`}
                              className={emp.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
                              onClick={() => handleToggleEmployee(emp)}
                            >
                              {emp.is_active ? <><UserX className="h-4 w-4 mr-1" /> Deactivate</> : <><UserCheck className="h-4 w-4 mr-1" /> Activate</>}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No employees found. Add your first employee to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  Pending Approvals ({pendingApprovals.length})
                </CardTitle>
                {!canApprove && (
                  <CardDescription className="text-amber-400">
                    Your role ({corpRole}) cannot approve bookings. Only admin, manager or approver roles can.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8 text-slate-400" data-testid="no-pending-approvals">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>All caught up! No pending approvals.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApprovals.map((approval) => (
                      <div key={approval.approval_id} className="p-4 bg-slate-700/50 rounded-lg" data-testid={`approval-card-${approval.approval_id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-medium">{approval.employee_name} <span className="text-slate-500 text-xs">({approval.department})</span></p>
                            <p className="text-slate-400 text-sm">{approval.route || ''} {approval.travel_date ? `• ${approval.travel_date}` : ''}</p>
                            <p className="text-slate-500 text-sm">{approval.purpose}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(approval.amount)}</p>
                            <Badge className={approval.urgency === 'urgent' ? 'bg-red-500' : 'bg-blue-500'}>
                              {approval.urgency}
                            </Badge>
                          </div>
                        </div>
                        {canApprove && (
                          <div className="flex gap-2">
                            <Button
                              data-testid={`approve-${approval.approval_id}`}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprovalAction(approval.approval_id, 'approve')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" /> Approve
                            </Button>
                            <Button
                              data-testid={`reject-${approval.approval_id}`}
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleApprovalAction(approval.approval_id, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-2" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Budgets Tab */}
        {activeTab === 'budgets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map((budget) => (
              <Card key={budget.department} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{budget.department}</CardTitle>
                  <CardDescription>{budget.period} budget</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget</span>
                      <span className="text-white">{formatCurrency(budget.budget_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Used</span>
                      <span className="text-red-400">{formatCurrency(budget.budget_used)}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${budget.utilization_percent > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(budget.utilization_percent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Remaining</span>
                      <span className="text-green-400 font-semibold">{formatCurrency(budget.budget_remaining)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {budgets.length === 0 && (
              <Card className="bg-slate-800/50 border-slate-700 col-span-full">
                <CardContent className="p-8 text-center text-slate-400">
                  <Wallet className="h-12 w-12 mx-auto mb-3" />
                  <p>No department budgets configured yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <BarChart3 className="h-10 w-10 text-purple-400" />
                    <div>
                      <p className="text-slate-400 text-sm">Total Spend</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(analytics.total_spend)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <TrendingUp className="h-10 w-10 text-green-400" />
                    <div>
                      <p className="text-slate-400 text-sm">Avg Booking Value</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(analytics.average_booking_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <FileText className="h-10 w-10 text-blue-400" />
                    <div>
                      <p className="text-slate-400 text-sm">Total Bookings</p>
                      <p className="text-2xl font-bold text-white">{analytics.total_bookings}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Top Travelers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.top_travelers?.map((traveler, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-white font-medium">{traveler.name}</p>
                          <p className="text-slate-400 text-sm">{traveler.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{formatCurrency(traveler.total_spend)}</p>
                        <p className="text-slate-400 text-sm">{traveler.bookings_count} bookings</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporateDashboard;
