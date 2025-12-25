import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Tag, Bell, Mail, MessageSquare, Plus,
  Loader2, RefreshCw, Play, Pause, Eye, Trash2,
  TrendingUp, Users, Gift, Calendar, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function MarketingCampaigns() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPromoForm, setShowPromoForm] = useState(false);

  const [newPromo, setNewPromo] = useState({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: 10,
    min_booking_value: 0,
    max_discount: null,
    max_uses: null,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    loadDashboard();
    loadCampaigns();
    loadPromoCodes();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/marketing/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await api.get('/marketing/campaigns');
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadPromoCodes = async () => {
    try {
      const response = await api.get('/marketing/promo-codes');
      setPromoCodes(response.data.promo_codes || []);
    } catch (error) {
      console.error('Failed to load promo codes:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/marketing/notifications');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const createPromoCode = async () => {
    try {
      await api.post('/marketing/promo-codes', {
        ...newPromo,
        code: newPromo.code.toUpperCase()
      });
      toast.success('Promo code created');
      setShowPromoForm(false);
      loadPromoCodes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create promo code');
    }
  };

  const updatePromoStatus = async (promoId, status) => {
    try {
      await api.put(`/marketing/promo-codes/${promoId}/status?status=${status}`);
      toast.success(`Promo code ${status}`);
      loadPromoCodes();
    } catch (error) {
      toast.error('Failed to update promo code');
    }
  };

  const updateCampaignStatus = async (campaignId, status) => {
    try {
      await api.put(`/marketing/campaigns/${campaignId}/status?status=${status}`);
      toast.success(`Campaign ${status}`);
      loadCampaigns();
    } catch (error) {
      toast.error('Failed to update campaign');
    }
  };

  const statusColors = {
    draft: 'bg-slate-500',
    scheduled: 'bg-blue-500',
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-purple-500',
    active: 'bg-green-500',
    expired: 'bg-red-500'
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
            <Megaphone className="h-6 w-6 text-pink-400" />
            Marketing & Campaigns / मार्केटिंग
          </h2>
          <p className="text-slate-400 mt-1">Manage campaigns, promo codes, and push notifications</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadCampaigns(); loadPromoCodes(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'campaigns', label: 'Campaigns', icon: Mail },
          { id: 'promos', label: 'Promo Codes', icon: Tag },
          { id: 'notifications', label: 'Push Notifications', icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'notifications') loadNotifications(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-pink-500 text-white' : 'text-slate-400 hover:bg-slate-800'
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
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Megaphone className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Active Campaigns</p>
                  <p className="text-white text-2xl font-bold">{dashboard.active_campaigns}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Tag className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Active Promos</p>
                  <p className="text-white text-2xl font-bold">{dashboard.active_promo_codes}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Gift className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Promo Uses</p>
                  <p className="text-white text-2xl font-bold">{dashboard.promo_usage?.total_uses || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Discount Given</p>
                  <p className="text-white text-2xl font-bold">₹{dashboard.promo_usage?.total_discount_given?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Recent Campaign Performance</h3>
            <div className="space-y-3">
              {dashboard.recent_campaigns?.map(campaign => (
                <div key={campaign.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{campaign.name}</p>
                    <p className="text-slate-400 text-sm">{campaign.type}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-slate-300">{campaign.stats?.opened || 0} opened</p>
                      <p className="text-slate-500 text-sm">{campaign.stats?.converted || 0} converted</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {(!dashboard.recent_campaigns || dashboard.recent_campaigns.length === 0) && (
                <p className="text-slate-400 text-center py-4">No campaigns yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-pink-500 hover:bg-pink-600">
              <Plus className="h-4 w-4 mr-2" /> Create Campaign
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Mail className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No Campaigns</p>
              <p className="text-slate-400 text-sm">Create email, SMS, or push notification campaigns</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold">{campaign.name}</p>
                      <p className="text-slate-400 text-sm">{campaign.campaign_code} • {campaign.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[campaign.status]}`}>
                        {campaign.status}
                      </span>
                      {campaign.status === 'running' ? (
                        <Button size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign.id, 'paused')}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : campaign.status === 'paused' && (
                        <Button size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign.id, 'running')}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-slate-400">Sent</p>
                      <p className="text-white">{campaign.stats?.total_sent || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Opened</p>
                      <p className="text-white">{campaign.stats?.opened || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Clicked</p>
                      <p className="text-white">{campaign.stats?.clicked || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Converted</p>
                      <p className="text-green-400">{campaign.stats?.converted || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Promo Codes Tab */}
      {activeTab === 'promos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPromoForm(true)} className="bg-purple-500 hover:bg-purple-600">
              <Plus className="h-4 w-4 mr-2" /> Create Promo Code
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promoCodes.map(promo => (
              <div key={promo.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-bold text-lg">{promo.code}</p>
                    <p className="text-slate-400 text-sm">{promo.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[promo.status]}`}>
                    {promo.status}
                  </span>
                </div>
                
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-green-400 text-xl font-bold">
                    {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : `₹${promo.discount_value} OFF`}
                  </p>
                  {promo.min_booking_value > 0 && (
                    <p className="text-slate-400 text-sm">Min: ₹{promo.min_booking_value}</p>
                  )}
                  {promo.max_discount && (
                    <p className="text-slate-400 text-sm">Max: ₹{promo.max_discount}</p>
                  )}
                </div>
                
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="text-slate-400">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(promo.valid_until).toLocaleDateString()}
                  </div>
                  <div className="text-slate-400">
                    Used: {promo.used_count}/{promo.max_uses || '∞'}
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  {promo.status === 'active' ? (
                    <Button size="sm" variant="outline" onClick={() => updatePromoStatus(promo.id, 'paused')}>
                      <Pause className="h-3 w-3 mr-1" /> Pause
                    </Button>
                  ) : promo.status === 'paused' && (
                    <Button size="sm" variant="outline" onClick={() => updatePromoStatus(promo.id, 'active')}>
                      <Play className="h-3 w-3 mr-1" /> Activate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {promoCodes.length === 0 && (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Tag className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No Promo Codes</p>
              <p className="text-slate-400 text-sm">Create discount codes for customers</p>
            </div>
          )}

          {/* Create Promo Form Modal */}
          {showPromoForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-white font-semibold text-lg mb-4">Create Promo Code</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Promo Code *</Label>
                    <Input
                      value={newPromo.code}
                      onChange={(e) => setNewPromo(prev => ({...prev, code: e.target.value.toUpperCase()}))}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                      placeholder="SAVE20"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Description</Label>
                    <Input
                      value={newPromo.description}
                      onChange={(e) => setNewPromo(prev => ({...prev, description: e.target.value}))}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                      placeholder="20% off on all bookings"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Discount Type</Label>
                      <select
                        value={newPromo.discount_type}
                        onChange={(e) => setNewPromo(prev => ({...prev, discount_type: e.target.value}))}
                        className="w-full bg-slate-800 border-slate-600 text-white rounded p-2 mt-1"
                      >
                        <option value="percent">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Discount Value</Label>
                      <Input
                        type="number"
                        value={newPromo.discount_value}
                        onChange={(e) => setNewPromo(prev => ({...prev, discount_value: parseFloat(e.target.value)}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Min Booking (₹)</Label>
                      <Input
                        type="number"
                        value={newPromo.min_booking_value}
                        onChange={(e) => setNewPromo(prev => ({...prev, min_booking_value: parseFloat(e.target.value)}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Max Discount (₹)</Label>
                      <Input
                        type="number"
                        value={newPromo.max_discount || ''}
                        onChange={(e) => setNewPromo(prev => ({...prev, max_discount: e.target.value ? parseFloat(e.target.value) : null}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="No limit"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Valid From</Label>
                      <Input
                        type="date"
                        value={newPromo.valid_from}
                        onChange={(e) => setNewPromo(prev => ({...prev, valid_from: e.target.value}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Valid Until</Label>
                      <Input
                        type="date"
                        value={newPromo.valid_until}
                        onChange={(e) => setNewPromo(prev => ({...prev, valid_until: e.target.value}))}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button onClick={() => setShowPromoForm(false)} variant="outline">Cancel</Button>
                  <Button onClick={createPromoCode} className="bg-purple-500 hover:bg-purple-600">Create</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Push Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" /> Create Notification
            </Button>
          </div>

          {notifications.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Bell className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No Push Notifications</p>
              <p className="text-slate-400 text-sm">Send targeted notifications to users</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">{notif.title}</p>
                      <p className="text-slate-400 text-sm">{notif.message}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[notif.status]}`}>
                      {notif.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MarketingCampaigns;
