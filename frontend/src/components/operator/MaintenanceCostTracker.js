import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, 
  AlertTriangle, CheckCircle, RefreshCw, Calendar, Wrench,
  ArrowUpRight, ArrowDownRight, Minus, Edit2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function MaintenanceCostTracker() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [editingCost, setEditingCost] = useState(null);
  const [actualCost, setActualCost] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/cost-tracker?months=6`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  const updateActualCost = async () => {
    if (!editingCost || !actualCost) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/schedules/${editingCost.id}/actual-cost`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actual_cost: parseFloat(actualCost),
          actual_hours: parseFloat(actualHours) || 0,
          notes: notes
        })
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      toast.success('Actual cost updated!');
      setEditingCost(null);
      setActualCost('');
      setActualHours('');
      setNotes('');
      loadData();
    } catch (error) {
      toast.error('Failed to update cost');
    }
  };

  const getVarianceColor = (percent) => {
    if (percent > 10) return 'text-red-400';
    if (percent < -10) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getVarianceIcon = (percent) => {
    if (percent > 10) return <ArrowUpRight className="h-4 w-4 text-red-400" />;
    if (percent < -10) return <ArrowDownRight className="h-4 w-4 text-green-400" />;
    return <Minus className="h-4 w-4 text-yellow-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-green-400" />
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
            Maintenance Cost Tracker</h2>
          <p className="text-slate-400 mt-1">Track estimated vs actual costs with variance analysis</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-slate-600">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
          <DollarSign className="h-6 w-6 text-blue-400 mb-2" />
          <p className="text-2xl font-bold text-white">₹{(data?.summary?.total_estimated || 0).toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Estimated</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
          <DollarSign className="h-6 w-6 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-green-400">₹{(data?.summary?.total_actual || 0).toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Actual</p>
        </div>
        <div className={`bg-gradient-to-br rounded-xl p-4 border ${
          data?.summary?.total_variance > 0 
            ? 'from-red-500/20 to-rose-500/20 border-red-500/30' 
            : 'from-green-500/20 to-emerald-500/20 border-green-500/30'
        }`}>
          {data?.summary?.total_variance > 0 ? (
            <TrendingUp className="h-6 w-6 text-red-400 mb-2" />
          ) : (
            <TrendingDown className="h-6 w-6 text-green-400 mb-2" />
          )}
          <p className={`text-2xl font-bold ${data?.summary?.total_variance > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {data?.summary?.total_variance > 0 ? '+' : ''}₹{(data?.summary?.total_variance || 0).toLocaleString()}
          </p>
          <p className="text-slate-400 text-sm">
            Variance ({data?.summary?.variance_percent > 0 ? '+' : ''}{data?.summary?.variance_percent}%)
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
          <BarChart3 className="h-6 w-6 text-purple-400 mb-2" />
          <p className="text-2xl font-bold text-purple-400">{data?.summary?.completed_count || 0}</p>
          <p className="text-slate-400 text-sm">Completed</p>
        </div>
      </div>

      {/* Budget Status Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-white font-medium">On Budget</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{data?.summary?.on_budget || 0}</p>
          <p className="text-slate-500 text-sm">Within ±10% of estimate</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">Under Budget</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{data?.summary?.under_budget || 0}</p>
          <p className="text-slate-500 text-sm">More than 10% savings</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-white font-medium">Over Budget</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{data?.summary?.over_budget || 0}</p>
          <p className="text-slate-500 text-sm">More than 10% over</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Monthly Cost Trend</h3>
          {data?.monthly_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Line type="monotone" dataKey="estimated" stroke="#3b82f6" name="Estimated" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="#22c55e" name="Actual" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No data available</div>
          )}
        </div>

        {/* By Type Breakdown */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-400" />
            Cost by Type</h3>
          {data?.by_type?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.by_type} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis dataKey="type" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="estimated" fill="#3b82f6" name="Estimated" />
                <Bar dataKey="actual" fill="#22c55e" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">No data available</div>
          )}
        </div>
      </div>

      {/* Variance Details Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-400" />
            Cost Variance Details</h3>
        </div>
        
        {data?.variance_details?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Aircraft</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Type</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Date</th>
                  <th className="text-right p-3 text-slate-400 font-medium text-sm">Estimated</th>
                  <th className="text-right p-3 text-slate-400 font-medium text-sm">Actual</th>
                  <th className="text-right p-3 text-slate-400 font-medium text-sm">Variance</th>
                  <th className="text-center p-3 text-slate-400 font-medium text-sm">Status</th>
                  <th className="text-center p-3 text-slate-400 font-medium text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.variance_details.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800/50">
                    <td className="p-3">
                      <span className="text-white font-medium">{item.aircraft}</span>
                    </td>
                    <td className="p-3 text-slate-400 capitalize">{item.type}</td>
                    <td className="p-3 text-slate-400">
                      {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                    </td>
                    <td className="p-3 text-right text-blue-400">₹{item.estimated_cost?.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-400">₹{item.actual_cost?.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getVarianceIcon(item.variance_percent)}
                        <span className={getVarianceColor(item.variance_percent)}>
                          {item.variance > 0 ? '+' : ''}₹{item.variance?.toLocaleString()}
                          <span className="text-xs ml-1">({item.variance_percent}%)</span>
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'over' ? 'bg-red-500/20 text-red-400' :
                        item.status === 'under' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.status === 'over' ? 'Over' : item.status === 'under' ? 'Under' : 'On Budget'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setEditingCost(item);
                          setActualCost(item.actual_cost?.toString() || '');
                        }}
                        className="p-1.5 hover:bg-slate-700 rounded"
                      >
                        <Edit2 className="h-4 w-4 text-blue-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <DollarSign className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No completed maintenance with cost data</p>
          </div>
        )}
      </div>

      {/* Edit Cost Modal */}
      {editingCost && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Update Actual Cost</h3>
              <button onClick={() => setEditingCost(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-sm">Maintenance</p>
                <p className="text-white">{editingCost.aircraft} - {editingCost.type}</p>
                <p className="text-slate-500 text-xs mt-1">{editingCost.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <p className="text-slate-400 text-xs">Estimated</p>
                  <p className="text-blue-400 font-bold">₹{editingCost.estimated_cost?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-slate-400 text-xs">Current Actual</p>
                  <p className="text-green-400 font-bold">₹{editingCost.actual_cost?.toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <label className="text-white text-sm block mb-1">Actual Cost (₹) *</label>
                <Input
                  type="number"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  placeholder="Enter actual cost"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <label className="text-white text-sm block mb-1">Actual Hours</label>
                <Input
                  type="number"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  placeholder="Enter actual hours"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <label className="text-white text-sm block mb-1">Notes</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {actualCost && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-sm">New Variance</p>
                  <p className={`font-bold ${
                    parseFloat(actualCost) > editingCost.estimated_cost ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {parseFloat(actualCost) > editingCost.estimated_cost ? '+' : ''}
                    ₹{(parseFloat(actualCost) - editingCost.estimated_cost).toLocaleString()}
                    ({((parseFloat(actualCost) - editingCost.estimated_cost) / editingCost.estimated_cost * 100).toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button onClick={() => setEditingCost(null)} variant="outline" className="flex-1 border-slate-600">
                Cancel
              </Button>
              <Button onClick={updateActualCost} className="flex-1 bg-green-600 hover:bg-green-700">
                Update Cost
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaintenanceCostTracker;
