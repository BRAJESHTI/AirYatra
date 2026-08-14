import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, UserX, UserCheck, Key, Shield, Search, Filter, RefreshCw, History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { userManagementAPI } from '@/services/api';
import { toast } from 'sonner';

const ROLES = [
  { id: 'regional_manager', name: 'Regional Manager', name_hi: '', color: 'blue' },
  { id: 'hr', name: 'HR', name_hi: '', color: 'pink' },
  { id: 'finance', name: 'Finance', name_hi: '', color: 'green' },
  { id: 'marketing', name: 'Marketing', name_hi: '', color: 'purple' },
  { id: 'operations', name: 'Operations', name_hi: '', color: 'orange' },
  { id: 'admin', name: 'Admin', name_hi: '', color: 'red' },
  { id: 'super_admin', name: 'Super Admin', name_hi: '', color: 'yellow' },
];

const REGIONS = ['North', 'South', 'East', 'West', 'Central', 'Northeast'];

function UserRoleManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filters, setFilters] = useState({ status: '', role: '', region: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    roles: [],
    region: '',
    regions_access: [],
    department: '',
    designation: ''
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    try {
      const response = await userManagementAPI.getAllUsers(filters);
      setUsers(response.data.users || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.full_name || formData.roles.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      await userManagementAPI.createUser(formData);
      toast.success('User created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    try {
      await userManagementAPI.updateUser(selectedUser.id, formData);
      toast.success('User updated successfully');
      setShowEditDialog(false);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const reason = !currentStatus ? '' : prompt('Enter reason for disabling user (required):');
    if (!currentStatus && !reason) return;
    
    try {
      await userManagementAPI.toggleUserStatus(userId, { is_active: !currentStatus, reason });
      toast.success(`User ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to toggle status');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    try {
      await userManagementAPI.resetPassword(userId, { new_password: newPassword });
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      roles: [],
      region: '',
      regions_access: [],
      department: '',
      designation: ''
    });
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      phone: user.phone || '',
      roles: user.roles || [],
      region: user.region || '',
      regions_access: user.regions_access || [],
      department: user.department || '',
      designation: user.designation || ''
    });
    setShowEditDialog(true);
  };

  const toggleRole = (roleId) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (roleId) => {
    const role = ROLES.find(r => r.id === roleId);
    const colors = {
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    };
    return colors[role?.color] || 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-400" />
            User & Role Management
          </h2>
          <p className="text-slate-400">Manage internal users and their roles</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadUsers} variant="outline" className="border-slate-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={filters.role}
          onChange={(e) => setFilters({...filters, role: e.target.value})}
          className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
        >
          <option value="">All Roles</option>
          {ROLES.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <select
          value={filters.region}
          onChange={(e) => setFilters({...filters, region: e.target.value})}
          className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
        >
          <option value="">All Regions</option>
          {REGIONS.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-lg bg-slate-900/50 border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">User</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Roles</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Created By</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">No users found</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{user.full_name}</p>
                      <p className="text-slate-400 text-sm">{user.email}</p>
                      {user.designation && <p className="text-slate-500 text-xs">{user.designation}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {user.roles?.map(role => (
                        <span key={role} className={`px-2 py-0.5 rounded text-xs border ${getRoleColor(role)}`}>
                          {ROLES.find(r => r.id === role)?.name || role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.region || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{user.created_by_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)} title="Edit">
                        <Edit className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleResetPassword(user.id)} title="Reset Password">
                        <Key className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        title={user.is_active ? 'Disable' : 'Enable'}
                      >
                        {user.is_active ? 
                          <UserX className="h-4 w-4 text-red-400" /> : 
                          <UserCheck className="h-4 w-4 text-green-400" />
                        }
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-400" />
              Create Internal User</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Full Name *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Enter full name"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter email"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Min 8 characters"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Enter phone"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Primary Region</Label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({...formData, region: e.target.value})}
                className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select Region</option>
                {REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({...formData, designation: e.target.value})}
                placeholder="e.g., Manager, Executive"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label className="text-white">Roles * (Select multiple)</Label>
              <div className="flex gap-2 flex-wrap p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                {ROLES.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      formData.roles.includes(role.id)
                        ? `${getRoleColor(role.id)} border`
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} className="bg-orange-500 hover:bg-orange-600">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="h-5 w-5 text-orange-400" />
              Edit User</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Primary Region</Label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({...formData, region: e.target.value})}
                className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select Region</option>
                {REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({...formData, designation: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label className="text-white">Roles</Label>
              <div className="flex gap-2 flex-wrap p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                {ROLES.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      formData.roles.includes(role.id)
                        ? `${getRoleColor(role.id)} border`
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} className="bg-orange-500 hover:bg-orange-600">
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserRoleManagement;
