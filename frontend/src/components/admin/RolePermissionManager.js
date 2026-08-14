import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, Check, X, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { userManagementAPI } from '@/services/api';
import { toast } from 'sonner';

function RolePermissionManager() {
  const [systemRoles, setSystemRoles] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [permissionMatrix, setPermissionMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    name_hi: '',
    description: '',
    permissions: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, permRes] = await Promise.all([
        userManagementAPI.getAllRoles(),
        userManagementAPI.getPermissions()
      ]);
      setSystemRoles(rolesRes.data.system_roles || []);
      setCustomRoles(rolesRes.data.custom_roles || []);
      setPermissionMatrix(permRes.data.permission_matrix || {});
    } catch (error) {
      toast.error('Failed to load roles data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!formData.name || formData.permissions.length === 0) {
      toast.error('Please enter role name and select permissions');
      return;
    }
    try {
      await userManagementAPI.createRole(formData);
      toast.success('Role created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    try {
      await userManagementAPI.updateRole(selectedRole.id, formData);
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await userManagementAPI.deleteRole(roleId);
      toast.success('Role deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const togglePermission = (permId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const resetForm = () => {
    setFormData({ id: '', name: '', name_hi: '', description: '', permissions: [] });
  };

  const openEditDialog = (role) => {
    setSelectedRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      name_hi: role.name_hi || '',
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowEditDialog(true);
  };

  const roleColors = {
    customer: 'bg-blue-500',
    operator: 'bg-green-500',
    regional_manager: 'bg-purple-500',
    hr: 'bg-pink-500',
    finance: 'bg-emerald-500',
    marketing: 'bg-indigo-500',
    operations: 'bg-orange-500',
    admin: 'bg-red-500',
    super_admin: 'bg-yellow-500'
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-400" />
            Role & Permission Manager
          </h2>
          <p className="text-slate-400 mt-1">Manage roles and their permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" /> Create Custom Role
        </Button>
      </div>

      {/* System Roles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">System Roles (</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemRoles.map(role => (
            <div key={role.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${roleColors[role.id] || 'bg-slate-500'}`}></span>
                  <span className="text-white font-medium">{role.name}</span>
                </div>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">System</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map(perm => (
                  <span key={perm} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {perm.replace(/_/g, ' ')}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="text-xs text-orange-400">+{role.permissions.length - 5} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Roles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Custom Roles (</h3>
        {customRoles.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/50 border border-dashed border-slate-700 text-center">
            <Shield className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No custom roles created yet</p>
            <p className="text-slate-500 text-sm">Click "Create Custom Role" to add one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customRoles.map(role => (
              <div key={role.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                    <span className="text-white font-medium">{role.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(role)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDeleteRole(role.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-3">{role.description}</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 4).map(perm => (
                    <span key={perm} className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                      {perm.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {role.permissions.length > 4 && (
                    <span className="text-xs text-cyan-400">+{role.permissions.length - 4} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permission Matrix Preview */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Permission Matrix (</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(permissionMatrix).map(([category, data]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-orange-400 font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {data.label} ({data.label_hi})
              </h4>
              <div className="space-y-1">
                {data.permissions.map(perm => (
                  <div key={perm.id} className="flex items-center gap-2 text-sm text-slate-400">
                    <Check className="h-3 w-3 text-green-400" />
                    {perm.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Create Custom Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Quality Control"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Hindi Name</Label>
                <Input
                  value={formData.name_hi}
                  onChange={(e) => setFormData({ ...formData, name_hi: e.target.value })}
                  placeholder="e.g., Quality Control"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What can this role do?"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            
            {/* Permission Selection */}
            <div className="space-y-4">
              <Label className="text-orange-400">Select Permissions * (</Label>
              {Object.entries(permissionMatrix).map(([category, data]) => (
                <div key={category} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <h5 className="text-white font-medium mb-2">{data.label}</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {data.permissions.map(perm => (
                      <label key={perm.id} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <Checkbox
                          checked={formData.permissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-sm text-slate-500">
              Selected: {formData.permissions.length} permissions
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRole} className="bg-orange-500 hover:bg-orange-600">
              <Save className="h-4 w-4 mr-2" /> Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Role: {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Hindi Name</Label>
                <Input
                  value={formData.name_hi}
                  onChange={(e) => setFormData({ ...formData, name_hi: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            
            <div className="space-y-4">
              <Label className="text-orange-400">Permissions</Label>
              {Object.entries(permissionMatrix).map(([category, data]) => (
                <div key={category} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <h5 className="text-white font-medium mb-2">{data.label}</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {data.permissions.map(perm => (
                      <label key={perm.id} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <Checkbox
                          checked={formData.permissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateRole} className="bg-orange-500 hover:bg-orange-600">
              <Save className="h-4 w-4 mr-2" /> Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RolePermissionManager;
