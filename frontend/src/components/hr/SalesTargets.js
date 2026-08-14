import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Award, Users, Plus, Edit, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/apiClient';

export default function SalesTargets({ activeTab, user }) {
  const [targets, setTargets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    employee_name: '',
    target_type: 'monthly',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    revenue_target: '',
    leads_target: '',
    conversions_target: '',
    calls_target: '',
    meetings_target: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [targetsRes, leaderboardRes] = await Promise.all([
        api.get(`/hr/targets?month=${form.month}&year=${form.year}`),
        api.get(`/hr/targets/leaderboard?month=${form.month}&year=${form.year}`)
      ]);
      setTargets(targetsRes.data.targets || []);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTarget = async () => {
    try {
      await api.post('/hr/targets/create', {
        ...form,
        revenue_target: parseFloat(form.revenue_target) || 0,
        leads_target: parseInt(form.leads_target) || 0,
        conversions_target: parseInt(form.conversions_target) || 0,
        calls_target: parseInt(form.calls_target) || 0,
        meetings_target: parseInt(form.meetings_target) || 0,
        period_start: `${form.year}-${String(form.month).padStart(2, '0')}-01`,
        period_end: `${form.year}-${String(form.month).padStart(2, '0')}-28`
      });
      setShowForm(false);
      loadData();
      alert('Target created successfully');
    } catch (error) {
      alert('Failed to create target');
    }
  };

  const updateAchievement = async (targetId, field, value) => {
    try {
      await api.put(`/hr/targets/${targetId}/update-achievement`, {
        [field]: parseFloat(value)
      });
      loadData();
    } catch (error) {
      alert('Failed to update');
    }
  };

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 80) return 'bg-yellow-500';
    if (percent >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-white">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Sales Targets</h2>
          <p className="text-slate-400">Manage sales targets and track achievements</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" /> New Target</Button>
      </div>

      {/* Create Target Form */}
      {showForm && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Create Sales Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300">Employee ID</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="emp-001"
                  value={form.employee_id}
                  onChange={(e) => setForm({...form, employee_id: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Employee Name</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="John Doe"
                  value={form.employee_name}
                  onChange={(e) => setForm({...form, employee_name: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Month</Label>
                <select
                  className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                  value={form.month}
                  onChange={(e) => setForm({...form, month: parseInt(e.target.value)})}
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>{new Date(2024, m-1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <Label className="text-slate-300">Revenue Target (₹)</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="500000"
                  value={form.revenue_target}
                  onChange={(e) => setForm({...form, revenue_target: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Leads Target</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="50"
                  value={form.leads_target}
                  onChange={(e) => setForm({...form, leads_target: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Conversions Target</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="10"
                  value={form.conversions_target}
                  onChange={(e) => setForm({...form, conversions_target: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Calls Target</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="200"
                  value={form.calls_target}
                  onChange={(e) => setForm({...form, calls_target: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Meetings Target</Label>
                <Input
                  type="number"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="20"
                  value={form.meetings_target}
                  onChange={(e) => setForm({...form, meetings_target: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createTarget} className="bg-orange-500 hover:bg-orange-600">Create Target</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {activeTab === 'leaderboard' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Trophy className="h-5 w-5 text-yellow-400 mr-2" /> Sales Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No data for this period</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={index} className={`p-4 rounded-lg flex items-center justify-between ${
                    index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                    index === 1 ? 'bg-slate-400/20 border border-slate-400/50' :
                    index === 2 ? 'bg-orange-700/20 border border-orange-700/50' :
                    'bg-slate-700/50'
                  }`}>
                    <div className="flex items-center gap-4">
                      <span className={`text-2xl font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-slate-300' :
                        index === 2 ? 'text-orange-400' : 'text-slate-400'
                      }`}>#{entry.rank}</span>
                      <div>
                        <p className="text-white font-medium">{entry.employee_name}</p>
                        <p className="text-slate-400 text-sm">{entry.conversions_achieved} conversions • {entry.leads_achieved} leads</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">{entry.achievement_percent}%</p>
                      <p className="text-slate-400 text-sm">₹{entry.revenue_achieved?.toLocaleString()} / ₹{entry.revenue_target?.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Targets List */}
      {activeTab !== 'leaderboard' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Active Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {targets.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No targets set for this period</p>
              ) : (
                targets.map((target) => (
                  <div key={target.id} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-white font-medium">{target.employee_name || 'Team Target'}</p>
                        <p className="text-slate-400 text-sm">{target.period_start} to {target.period_end}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${target.revenue_percent >= 100 ? 'text-green-400' : 'text-orange-400'}`}>
                          {target.revenue_percent}%
                        </p>
                        <p className="text-slate-400 text-sm">Achievement</p>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">Revenue</span>
                          <span className="text-white">₹{target.revenue_achieved?.toLocaleString()} / ₹{target.revenue_target?.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                          <div className={`h-full ${getProgressColor(target.revenue_percent)} transition-all`} style={{ width: `${Math.min(target.revenue_percent, 100)}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-4">
                        <div className="text-center p-2 bg-slate-800 rounded">
                          <p className="text-lg font-bold text-white">{target.leads_achieved}/{target.leads_target}</p>
                          <p className="text-slate-400 text-xs">Leads</p>
                        </div>
                        <div className="text-center p-2 bg-slate-800 rounded">
                          <p className="text-lg font-bold text-white">{target.conversions_achieved}/{target.conversions_target}</p>
                          <p className="text-slate-400 text-xs">Conversions</p>
                        </div>
                        <div className="text-center p-2 bg-slate-800 rounded">
                          <p className="text-lg font-bold text-white">{target.calls_achieved}/{target.calls_target}</p>
                          <p className="text-slate-400 text-xs">Calls</p>
                        </div>
                        <div className="text-center p-2 bg-slate-800 rounded">
                          <p className="text-lg font-bold text-white">{target.meetings_achieved}/{target.meetings_target}</p>
                          <p className="text-slate-400 text-xs">Meetings</p>
                        </div>
                      </div>

                      {/* Incentive Slabs */}
                      <div className="mt-4 p-3 bg-slate-800 rounded">
                        <p className="text-slate-300 text-sm mb-2">Incentive Slabs</p>
                        <div className="flex gap-2 flex-wrap">
                          {target.incentive_slabs?.map((slab, idx) => (
                            <span key={idx} className={`px-2 py-1 rounded text-xs ${
                              target.revenue_percent >= slab.min_percent && target.revenue_percent < slab.max_percent
                                ? 'bg-green-500/30 text-green-400 border border-green-500'
                                : 'bg-slate-700 text-slate-400'
                            }`}>
                              {slab.min_percent}-{slab.max_percent}%: ₹{slab.bonus_amount?.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
