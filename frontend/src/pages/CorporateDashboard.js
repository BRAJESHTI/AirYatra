import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  Building2, Users, CreditCard, TrendingUp, Plus, Search, 
  CheckCircle, Clock, XCircle, BarChart3, Wallet, FileText,
  UserPlus, Settings, ArrowUpRight, Filter, MoreVertical
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CorporateDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [corporate, setCorporate] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  // Form states
  const [newEmployee, setNewEmployee] = useState({
    name: '', email: '', phone: '', department: '', designation: '', role: 'traveler',
    travel_budget: 100000, requires_approval: true, approval_limit: 50000
  });
  
  const [registerForm, setRegisterForm] = useState({
    company_name: '', registration_number: '', gst_number: '', industry: '',
    company_size: '1-50', address: '', city: '', state: '', pincode: '',
    primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '',
    admin_email: user?.email || '', admin_name: user?.full_name || ''
  });

  useEffect(() => {
    fetchCorporateData();
  }, [user]);

  const fetchCorporateData = async () => {
    if (!user?.corporate_id) {
      setLoading(false);
      return;
    }

    try {
      const [corpRes, empRes, approvalRes, budgetRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/api/corporate/account/${user.corporate_id}`),
        fetch(`${API_URL}/api/corporate/employees/${user.corporate_id}`),
        fetch(`${API_URL}/api/corporate/approvals/pending/${user.corporate_id}`),
        fetch(`${API_URL}/api/corporate/budget/${user.corporate_id}`),
        fetch(`${API_URL}/api/corporate/analytics/${user.corporate_id}?period=monthly`)
      ]);

      const [corpData, empData, approvalData, budgetData, analyticsData] = await Promise.all([
        corpRes.json(), empRes.json(), approvalRes.json(), budgetRes.json(), analyticsRes.json()
      ]);

      if (corpData.success) setCorporate(corpData.corporate);
      if (empData.success) setEmployees(empData.employees);
      if (approvalData.success) setPendingApprovals(approvalData.approvals);
      if (budgetData.success) setBudgets(budgetData.budgets);
      if (analyticsData.success) setAnalytics(analyticsData.analytics);
    } catch (error) {
      console.error('Error fetching corporate data:', error);
    } finally {
      setLoading(false);
    }
  };

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
        alert('Corporate account registration submitted! Pending admin approval.');
        setShowRegister(false);
      } else {
        alert(data.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('Error registering:', error);
      alert('Registration failed. Please try again.');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/corporate/employee/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEmployee, corporate_id: user.corporate_id })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Employee ${newEmployee.name} added successfully!`);
        setShowAddEmployee(false);
        setNewEmployee({
          name: '', email: '', phone: '', department: '', designation: '', role: 'traveler',
          travel_budget: 100000, requires_approval: true, approval_limit: 50000
        });
        fetchCorporateData();
      } else {
        alert(data.detail || 'Failed to add employee');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
    }
  };

  const handleApprovalAction = async (approvalId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/corporate/approvals/action?approver_id=${user.employee_code || 'admin'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, action })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Booking ${action}d successfully!`);
        fetchCorporateData();
      }
    } catch (error) {
      console.error('Error processing approval:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Show registration form if no corporate account
  if (!user?.corporate_id && !corporate) {
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
                        onChange={(e) => setRegisterForm({...registerForm, company_name: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Registration Number *</label>
                      <Input 
                        value={registerForm.registration_number}
                        onChange={(e) => setRegisterForm({...registerForm, registration_number: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">GST Number *</label>
                      <Input 
                        value={registerForm.gst_number}
                        onChange={(e) => setRegisterForm({...registerForm, gst_number: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Industry *</label>
                      <Input 
                        value={registerForm.industry}
                        onChange={(e) => setRegisterForm({...registerForm, industry: e.target.value})}
                        placeholder="e.g., Technology, Manufacturing"
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Company Size *</label>
                      <select 
                        value={registerForm.company_size}
                        onChange={(e) => setRegisterForm({...registerForm, company_size: e.target.value})}
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
                        onChange={(e) => setRegisterForm({...registerForm, primary_contact_name: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Primary Contact Email *</label>
                      <Input 
                        type="email"
                        value={registerForm.primary_contact_email}
                        onChange={(e) => setRegisterForm({...registerForm, primary_contact_email: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Primary Contact Phone *</label>
                      <Input 
                        value={registerForm.primary_contact_phone}
                        onChange={(e) => setRegisterForm({...registerForm, primary_contact_phone: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400">Address *</label>
                    <Input 
                      value={registerForm.address}
                      onChange={(e) => setRegisterForm({...registerForm, address: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">City *</label>
                      <Input 
                        value={registerForm.city}
                        onChange={(e) => setRegisterForm({...registerForm, city: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">State *</label>
                      <Input 
                        value={registerForm.state}
                        onChange={(e) => setRegisterForm({...registerForm, state: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Pincode *</label>
                      <Input 
                        value={registerForm.pincode}
                        onChange={(e) => setRegisterForm({...registerForm, pincode: e.target.value})}
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{corporate?.company_name || 'Corporate Dashboard'}</h1>
            <p className="text-slate-400">Manage your corporate travel efficiently</p>
          </div>
          <Badge className={corporate?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}>
            {corporate?.status?.toUpperCase() || 'PENDING'}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {['overview', 'employees', 'approvals', 'budgets', 'analytics'].map((tab) => (
            <Button
              key={tab}
              data-testid={`tab-${tab}`}
              variant={activeTab === tab ? 'default' : 'outline'}
              className={activeTab === tab ? 'bg-orange-500' : 'border-slate-600 text-slate-300'}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Total Employees</p>
                      <p className="text-3xl font-bold text-white">{employees.length}</p>
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
                      <p className="text-3xl font-bold text-white">{corporate?.total_bookings || 0}</p>
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
                      <p className="text-3xl font-bold text-white">{pendingApprovals.length}</p>
                    </div>
                    <Clock className="h-10 w-10 text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    data-testid="quick-add-employee"
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => { setActiveTab('employees'); setShowAddEmployee(true); }}
                  >
                    <UserPlus className="h-4 w-4 mr-3" /> Add New Employee
                  </Button>
                  <Button className="w-full justify-start bg-slate-700 hover:bg-slate-600">
                    <FileText className="h-4 w-4 mr-3" /> Create Booking Request
                  </Button>
                  <Button 
                    className="w-full justify-start bg-slate-700 hover:bg-slate-600"
                    onClick={() => setActiveTab('approvals')}
                  >
                    <CheckCircle className="h-4 w-4 mr-3" /> Review Approvals ({pendingApprovals.length})
                  </Button>
                  <Button className="w-full justify-start bg-slate-700 hover:bg-slate-600">
                    <Settings className="h-4 w-4 mr-3" /> Manage Travel Policy
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
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search employees..."
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

            {/* Add Employee Form */}
            {showAddEmployee && (
              <Card className="bg-slate-800/50 border-orange-500/50">
                <CardHeader>
                  <CardTitle className="text-white">Add New Employee</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input 
                        placeholder="Full Name"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input 
                        type="email"
                        placeholder="Email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input 
                        placeholder="Phone"
                        value={newEmployee.phone}
                        onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input 
                        placeholder="Department"
                        value={newEmployee.department}
                        onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <Input 
                        placeholder="Designation"
                        value={newEmployee.designation}
                        onChange={(e) => setNewEmployee({...newEmployee, designation: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                      <select 
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                        className="h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                      >
                        <option value="traveler">Traveler</option>
                        <option value="booker">Booker</option>
                        <option value="approver">Approver</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setShowAddEmployee(false)}>Cancel</Button>
                      <Button type="submit" data-testid="submit-employee-btn" className="bg-orange-500">Add Employee</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Employees Table */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
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
                      {employees.map((emp) => (
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
                              <p className="text-white">{formatCurrency(emp.budget_remaining)}</p>
                              <p className="text-slate-400 text-xs">of {formatCurrency(emp.travel_budget)}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={emp.is_active ? 'bg-green-500' : 'bg-red-500'}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
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
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>All caught up! No pending approvals.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApprovals.map((approval) => (
                      <div key={approval.approval_id} className="p-4 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-medium">{approval.employee_name}</p>
                            <p className="text-slate-400 text-sm">{approval.purpose}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold">{formatCurrency(approval.amount)}</p>
                            <Badge className={approval.urgency === 'urgent' ? 'bg-red-500' : 'bg-blue-500'}>
                              {approval.urgency}
                            </Badge>
                          </div>
                        </div>
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

            {/* Top Travelers */}
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
