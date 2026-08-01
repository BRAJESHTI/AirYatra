import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Percent, Settings, Building2, Save, RefreshCw, Edit, DollarSign,
  TrendingUp, Users, AlertTriangle, CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminCommissionSettings() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialog, setEditDialog] = useState({ open: false, operator: null });
  const [newRate, setNewRate] = useState('');
  const [globalSettings, setGlobalSettings] = useState({
    default_operator_rate: 85,
    platform_fee: 15,
    gst_rate: 18,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Load operators
      const opRes = await fetch(`${API_URL}/api/admin/operators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (opRes.ok) {
        const opData = await opRes.json();
        setOperators(opData.operators || []);
      }
      
      // Load global settings
      const settingsRes = await fetch(`${API_URL}/api/admin/commission-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setGlobalSettings(prev => ({ ...prev, ...settings }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (operator) => {
    setEditDialog({ open: true, operator });
    setNewRate(operator.commission_rate?.toString() || globalSettings.default_operator_rate.toString());
  };

  const saveCommissionRate = async () => {
    if (!editDialog.operator) return;
    
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 50 || rate > 95) {
      toast.error('Commission rate must be between 50% and 95%');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/operators/${editDialog.operator.id}/commission`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commission_rate: rate }),
      });
      
      if (res.ok) {
        toast.success(`Commission rate updated for ${editDialog.operator.company_name}`);
        setEditDialog({ open: false, operator: null });
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update');
      }
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveGlobalSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/commission-settings`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(globalSettings),
      });
      
      if (res.ok) {
        toast.success('Global commission settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="commission-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="commission-settings">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Percent className="h-7 w-7 text-green-500" />
            Commission Settings
          </h1>
          <p className="text-slate-400 mt-1">Configure platform commission rates per operator</p>
        </div>
        <Button 
          onClick={loadData} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Global Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-orange-500" />
            Global Commission Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Default rates applied to new operators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-300">Default Operator Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="50"
                  max="95"
                  value={globalSettings.default_operator_rate}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, default_operator_rate: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-700 text-white w-24"
                />
                <span className="text-slate-400">%</span>
              </div>
              <p className="text-xs text-slate-500">Operator's share of booking amount</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Platform Fee</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="5"
                  max="50"
                  value={globalSettings.platform_fee}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, platform_fee: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-700 text-white w-24"
                />
                <span className="text-slate-400">%</span>
              </div>
              <p className="text-xs text-slate-500">AirYatra's commission</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">GST Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={globalSettings.gst_rate}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, gst_rate: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-700 text-white w-24"
                />
                <span className="text-slate-400">%</span>
              </div>
              <p className="text-xs text-slate-500">Tax on operator earnings</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
            <div className="text-sm text-slate-400">
              <span className="text-white font-semibold">{globalSettings.default_operator_rate}%</span> to operator + 
              <span className="text-orange-400 font-semibold"> {globalSettings.platform_fee}%</span> platform fee = 100%
            </div>
            <Button 
              onClick={saveGlobalSettings}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Operator Commission Rates */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            Operator Commission Rates
          </CardTitle>
          <CardDescription className="text-slate-400">
            Override default rate for specific operators
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operators.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No operators found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Operator</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Commission Rate</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Platform Fee</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, idx) => {
                    const rate = op.commission_rate || globalSettings.default_operator_rate;
                    const platformFee = 100 - rate;
                    const isCustom = op.commission_rate && op.commission_rate !== globalSettings.default_operator_rate;
                    
                    return (
                      <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{op.company_name}</p>
                              <p className="text-slate-500 text-xs">{op.contact_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={`border-0 ${
                            op.status === 'active' || op.verified 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {op.status === 'active' || op.verified ? (
                              <><CheckCircle className="h-3 w-3 mr-1" />Active</>
                            ) : (
                              <><AlertTriangle className="h-3 w-3 mr-1" />Pending</>
                            )}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-2xl font-bold text-green-400">{rate}%</span>
                            {isCustom && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                                Custom
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-orange-400 font-semibold">{platformFee}%</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => openEditDialog(op)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-green-500" />
              Edit Commission Rate
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Set custom commission rate for {editDialog.operator?.company_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-white font-semibold">{editDialog.operator?.company_name}</p>
                  <p className="text-slate-500 text-sm">{editDialog.operator?.contact_email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-slate-300">Operator Commission Rate (%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="50"
                    max="95"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white text-xl font-bold w-32 text-center"
                  />
                  <span className="text-slate-400 text-lg">%</span>
                </div>
                <p className="text-xs text-slate-500">
                  Platform will receive {100 - (parseFloat(newRate) || 0)}% commission
                </p>
              </div>
            </div>
            
            {/* Preview */}
            <div className="bg-slate-800/50 rounded-lg p-3 text-sm">
              <p className="text-slate-400 mb-2">On a ₹1,00,000 booking:</p>
              <div className="flex justify-between">
                <span className="text-slate-300">Operator receives:</span>
                <span className="text-green-400 font-semibold">₹{((parseFloat(newRate) || 0) * 1000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Platform receives:</span>
                <span className="text-orange-400 font-semibold">₹{((100 - (parseFloat(newRate) || 0)) * 1000).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditDialog({ open: false, operator: null })}
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={saveCommissionRate}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
