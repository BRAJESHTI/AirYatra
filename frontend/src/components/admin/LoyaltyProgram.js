import React, { useState, useEffect } from 'react';
import { 
  Crown, Users, Star, Gift, TrendingUp, Award, Building2,
  Loader2, RefreshCw, Plus, Settings, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function LoyaltyProgram() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [members, setMembers] = useState([]);
  const [corporateAccounts, setCorporateAccounts] = useState([]);
  const [tiersConfig, setTiersConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCorporateForm, setShowCorporateForm] = useState(false);

  const [newCorporate, setNewCorporate] = useState({
    company_name: '',
    gstin: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    credit_limit: 0,
    discount_percent: 0
  });

  useEffect(() => {
    loadDashboard();
    loadMembers();
    loadTiersConfig();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/loyalty/admin/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await api.get('/loyalty/admin/members');
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const loadCorporateAccounts = async () => {
    try {
      const response = await api.get('/loyalty/corporate/list');
      setCorporateAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Failed to load corporate accounts:', error);
    }
  };

  const loadTiersConfig = async () => {
    try {
      const response = await api.get('/loyalty/tiers/config');
      setTiersConfig(response.data);
    } catch (error) {
      console.error('Failed to load tiers config:', error);
    }
  };

  const createCorporateAccount = async () => {
    try {
      await api.post('/loyalty/corporate/create', newCorporate);
      toast.success('Corporate account created');
      setShowCorporateForm(false);
      loadCorporateAccounts();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to create corporate account');
    }
  };

  const tierColors = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-slate-400 to-slate-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-purple-400 to-purple-600'
  };

  const tierIcons = {
    bronze: <Award className="h-8 w-8" />,
    silver: <Star className="h-8 w-8" />,
    gold: <Crown className="h-8 w-8" />,
    platinum: <Crown className="h-8 w-8" />
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
            <Crown className="h-6 w-6 text-yellow-400" />
            VIP & Loyalty Program</h2>
          <p className="text-slate-400 mt-1">Manage customer tiers, points, and corporate accounts</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadMembers(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'corporate', label: 'Corporate Accounts', icon: Building2 },
          { id: 'tiers', label: 'Tier Config', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'corporate') loadCorporateAccounts(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Users className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Members</p>
                  <p className="text-white text-2xl font-bold">{dashboard.total_members}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Gift className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Points Issued</p>
                  <p className="text-white text-2xl font-bold">{dashboard.total_points_issued?.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Star className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Points Redeemed</p>
                  <p className="text-white text-2xl font-bold">{dashboard.points_redeemed?.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Corporate Accounts</p>
                  <p className="text-white text-2xl font-bold">{dashboard.corporate_accounts}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tier Distribution */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-6">Tier Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dashboard.tiers?.map(tier => (
                <div
                  key={tier.id}
                  className={`bg-gradient-to-br ${tierColors[tier.id]} rounded-xl p-4 text-white`}
                >
                  <div className="flex items-center justify-between mb-4">
                    {tierIcons[tier.id]}
                    <span className="text-3xl font-bold">{dashboard.tier_distribution?.[tier.id] || 0}</span>
                  </div>
                  <p className="font-semibold">{tier.name}</p>
                  <p className="text-sm opacity-80">{tier.discount_percent}% discount</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Member</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Tier</th>
                <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Lifetime Points</th>
                <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Available</th>
                <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Bookings</th>
                <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {members.map(member => (
                <tr key={member.user_id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{member.user_name || 'N/A'}</p>
                    <p className="text-slate-500 text-xs">{member.user_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs text-white bg-gradient-to-r ${tierColors[member.tier]}`}>
                      {member.tier?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {member.lifetime_points?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">
                    {member.available_points?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {member.total_bookings}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    ₹{member.total_spent?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {members.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No loyalty members yet</p>
            </div>
          )}
        </div>
      )}

      {/* Corporate Accounts Tab */}
      {activeTab === 'corporate' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCorporateForm(true)} className="bg-blue-500 hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" /> Add Corporate Account
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {corporateAccounts.map(account => (
              <div key={account.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{account.company_name}</p>
                    <p className="text-slate-400 text-sm">{account.account_number}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    account.status === 'active' ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'
                  }`}>
                    {account.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-slate-400">Contact</p>
                    <p className="text-slate-300">{account.contact_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Credit Limit</p>
                    <p className="text-slate-300">₹{account.credit_limit?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Discount</p>
                    <p className="text-green-400">{account.discount_percent}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total Spent</p>
                    <p className="text-slate-300">₹{account.total_spent?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {corporateAccounts.length === 0 && (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Building2 className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No Corporate Accounts</p>
              <p className="text-slate-400 text-sm">Create accounts for B2B clients with special pricing</p>
            </div>
          )}

          {/* Create Corporate Form Modal */}
          {showCorporateForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-white font-semibold text-lg mb-4">Add Corporate Account</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Company Name *</Label>
                    <Input
                      value={newCorporate.company_name}
                      onChange={(e) => setNewCorporate(prev => ({...prev, company_name: e.target.value}))}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">GSTIN</Label>
                    <Input
                      value={newCorporate.gstin}
                      onChange={(e) => setNewCorporate(prev => ({...prev, gstin: e.target.value}))}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Contact Name *</Label>
                      <Input
                        value={newCorporate.contact_name}
                        onChange={(e) => setNewCorporate(prev => ({...prev, contact_name: e.target.value}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Phone *</Label>
                      <Input
                        value={newCorporate.contact_phone}
                        onChange={(e) => setNewCorporate(prev => ({...prev, contact_phone: e.target.value}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">Email *</Label>
                    <Input
                      value={newCorporate.contact_email}
                      onChange={(e) => setNewCorporate(prev => ({...prev, contact_email: e.target.value}))}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Credit Limit (₹)</Label>
                      <Input
                        type="number"
                        value={newCorporate.credit_limit}
                        onChange={(e) => setNewCorporate(prev => ({...prev, credit_limit: parseFloat(e.target.value)}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Discount %</Label>
                      <Input
                        type="number"
                        value={newCorporate.discount_percent}
                        onChange={(e) => setNewCorporate(prev => ({...prev, discount_percent: parseFloat(e.target.value)}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button onClick={() => setShowCorporateForm(false)} variant="outline">Cancel</Button>
                  <Button onClick={createCorporateAccount} className="bg-blue-500 hover:bg-blue-600">Create Account</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tiers Config Tab */}
      {activeTab === 'tiers' && tiersConfig && (
        <div className="space-y-4">
          {tiersConfig.tiers?.map(tier => (
            <div
              key={tier.id}
              className={`bg-gradient-to-r ${tierColors[tier.id]} rounded-xl p-6 text-white`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {tierIcons[tier.id]}
                  <div>
                    <h3 className="text-xl font-bold">{tier.name}</h3>
                  </div>
                </div>
                <span className="text-2xl font-bold">{tier.min_points?.toLocaleString()} pts</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="opacity-70">Discount</p>
                  <p className="font-semibold">{tier.discount_percent}%</p>
                </div>
                <div>
                  <p className="opacity-70">Priority Booking</p>
                  <p className="font-semibold">{tier.priority_booking ? '✅ Yes' : '❌ No'}</p>
                </div>
                <div>
                  <p className="opacity-70">Free Cancellation</p>
                  <p className="font-semibold">{tier.free_cancellation ? '✅ Yes' : '❌ No'}</p>
                </div>
                <div>
                  <p className="opacity-70">Lounge Access</p>
                  <p className="font-semibold">{tier.lounge_access ? '✅ Yes' : '❌ No'}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="opacity-70 text-sm">Benefits:</p>
                <p className="text-sm">{tier.benefits?.join(' • ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LoyaltyProgram;
