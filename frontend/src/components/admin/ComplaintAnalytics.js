import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Users, Building2, RefreshCw, Loader2, Calendar, Filter, Download, PieChart, ArrowUp, ArrowDown, Flag, Scale, DollarSign, Award, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
];

export default function ComplaintAnalytics() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [operatorRankings, setOperatorRankings] = useState([]);
  const [resolutionTrends, setResolutionTrends] = useState([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch analytics data from backend
      const [statsRes, operatorsRes] = await Promise.all([
        api.get('/complaints/admin/dashboard'),
        api.get('/complaints/admin/all', { params: { limit: 100 } })
      ]);
      
      const complaints = operatorsRes.data.complaints || [];
      
      // Process analytics
      const stats = statsRes.data;
      
      // Calculate derived metrics
      const totalComplaints = complaints.length;
      const resolvedComplaints = complaints.filter(c => c.status?.startsWith('resolved') || c.status === 'closed');
      const upheldComplaints = complaints.filter(c => c.airyatra_decision === 'upheld');
      const dismissedComplaints = complaints.filter(c => c.airyatra_decision === 'dismissed');
      const pendingComplaints = complaints.filter(c => !c.status?.startsWith('resolved') && c.status !== 'closed');
      
      // Calculate average resolution time
      const resolvedWithDates = resolvedComplaints.filter(c => c.created_at && c.decision_date);
      let avgResolutionHours = 0;
      if (resolvedWithDates.length > 0) {
        const totalHours = resolvedWithDates.reduce((sum, c) => {
          const created = new Date(c.created_at);
          const resolved = new Date(c.decision_date);
          return sum + (resolved - created) / (1000 * 60 * 60);
        }, 0);
        avgResolutionHours = totalHours / resolvedWithDates.length;
      }
      
      // Category breakdown
      const categoryCount = {};
      complaints.forEach(c => {
        const cat = c.category || 'other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      
      const categoryList = Object.entries(categoryCount)
        .map(([category, count]) => ({
          category: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count,
          percentage: ((count / totalComplaints) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count);
      
      // Operator rankings (by complaint count - worst first)
      const operatorCount = {};
      complaints.forEach(c => {
        if (c.operator_id) {
          if (!operatorCount[c.operator_id]) {
            operatorCount[c.operator_id] = {
              operator_id: c.operator_id,
              operator_name: c.operator_name || `Operator ${c.operator_id.slice(0, 8)}`,
              total: 0,
              upheld: 0,
              dismissed: 0,
              pending: 0
            };
          }
          operatorCount[c.operator_id].total++;
          if (c.airyatra_decision === 'upheld') operatorCount[c.operator_id].upheld++;
          if (c.airyatra_decision === 'dismissed') operatorCount[c.operator_id].dismissed++;
          if (!c.status?.startsWith('resolved') && c.status !== 'closed') operatorCount[c.operator_id].pending++;
        }
      });
      
      const operatorList = Object.values(operatorCount)
        .map(op => ({
          ...op,
          score: 100 - (op.upheld * 10) - (op.pending * 5) + (op.dismissed * 2)  // Simple score
        }))
        .sort((a, b) => a.score - b.score)  // Worst first
        .slice(0, 10);
      
      // Severity breakdown
      const severityCount = { low: 0, medium: 0, high: 0, critical: 0 };
      complaints.forEach(c => {
        if (c.severity && severityCount.hasOwnProperty(c.severity)) {
          severityCount[c.severity]++;
        }
      });
      
      setAnalytics({
        totalComplaints,
        resolvedCount: resolvedComplaints.length,
        pendingCount: pendingComplaints.length,
        upheldCount: upheldComplaints.length,
        dismissedCount: dismissedComplaints.length,
        resolutionRate: totalComplaints > 0 ? ((resolvedComplaints.length / totalComplaints) * 100).toFixed(1) : 0,
        upheldRate: resolvedComplaints.length > 0 ? ((upheldComplaints.length / resolvedComplaints.length) * 100).toFixed(1) : 0,
        avgResolutionTime: avgResolutionHours.toFixed(1),
        severityBreakdown: severityCount,
        ...stats
      });
      
      setCategoryData(categoryList);
      setOperatorRankings(operatorList);
      
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatHours = (hours) => {
    const h = parseFloat(hours);
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="complaint-analytics">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-400" />
            Complaint Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Trends, resolution times, operator rankings</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button onClick={loadAnalytics} variant="outline" className="border-slate-600">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Flag className="h-5 w-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <p className="text-3xl font-bold text-white">{analytics?.totalComplaints || 0}</p>
          <p className="text-xs text-slate-400">Complaints Filed</p>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-xs text-green-400">+{analytics?.resolutionRate}%</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{analytics?.resolvedCount || 0}</p>
          <p className="text-xs text-slate-400">Resolved</p>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{analytics?.pendingCount || 0}</p>
          <p className="text-xs text-slate-400">Pending</p>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Scale className="h-5 w-5 text-red-400" />
            <span className="text-xs text-red-400">{analytics?.upheldRate}%</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{analytics?.upheldCount || 0}</p>
          <p className="text-xs text-slate-400">Upheld (Against Operator)</p>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-400">{analytics?.dismissedCount || 0}</p>
          <p className="text-xs text-slate-400">Dismissed</p>
        </div>

        <div className="glass p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">{formatHours(analytics?.avgResolutionTime || 0)}</p>
          <p className="text-xs text-slate-400">Avg Resolution Time</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-400" />
            Complaints by Category</h3>
          <div className="space-y-3">
            {categoryData.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No data available</p>
            ) : (
              categoryData.map((cat, idx) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-slate-400 w-6 text-sm">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm">{cat.category}</span>
                      <span className="text-slate-400 text-sm">{cat.count} ({cat.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            Severity Distribution</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-3xl font-bold text-green-400">{analytics?.severityBreakdown?.low || 0}</p>
              <p className="text-sm text-slate-400">Low</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
              <p className="text-3xl font-bold text-yellow-400">{analytics?.severityBreakdown?.medium || 0}</p>
              <p className="text-sm text-slate-400">Medium</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
              <p className="text-3xl font-bold text-orange-400">{analytics?.severityBreakdown?.high || 0}</p>
              <p className="text-sm text-slate-400">High</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
              <p className="text-3xl font-bold text-red-400">{analytics?.severityBreakdown?.critical || 0}</p>
              <p className="text-sm text-slate-400">Critical</p>
            </div>
          </div>
          
          {/* Quick Insights */}
          <div className="mt-4 p-3 rounded-lg bg-slate-800/50">
            <p className="text-sm text-slate-300">
              <strong>Quick Insight:</strong>{' '}
              {((analytics?.severityBreakdown?.high || 0) + (analytics?.severityBreakdown?.critical || 0)) > 
               ((analytics?.severityBreakdown?.low || 0) + (analytics?.severityBreakdown?.medium || 0))
                ? 'High severity complaints are dominant - escalate operator training.'
                : 'Most complaints are low-medium severity - good service quality overall.'}
            </p>
          </div>
        </div>
      </div>

      {/* Operator Rankings Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-red-400" />
            Operator Complaint Rankings</h3>
          <p className="text-slate-400 text-sm mt-1">Operators with most complaints (worst to best)</p>
        </div>
        
        {operatorRankings.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Award className="h-12 w-12 mx-auto mb-2 text-green-400" />
            <p>No operator complaints yet - great news!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-4 text-slate-400 font-medium">Rank</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Operator</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Total</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Upheld</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Dismissed</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Pending</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {operatorRankings.map((op, idx) => {
                  const healthColor = op.score >= 80 ? 'text-green-400' : 
                                      op.score >= 60 ? 'text-yellow-400' : 
                                      op.score >= 40 ? 'text-orange-400' : 'text-red-400';
                  
                  return (
                    <tr key={op.operator_id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                      <td className="p-4">
                        <span className={`font-bold ${idx < 3 ? 'text-red-400' : 'text-slate-400'}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-white font-medium">{op.operator_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{op.operator_id.slice(0, 12)}...</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-white font-semibold">{op.total}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-red-400">{op.upheld}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-green-400">{op.dismissed}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-yellow-400">{op.pending}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-bold ${healthColor}`}>
                          {Math.max(0, Math.min(100, op.score))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Recommendations */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-400" />
          Recommended Actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {analytics?.pendingCount > 10 && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-yellow-400 font-medium mb-1">⚠️ High Pending Count</p>
              <p className="text-sm text-slate-400">
                {analytics.pendingCount} complaints pending. Consider adding more investigators.
              </p>
            </div>
          )}
          {parseFloat(analytics?.upheldRate || 0) > 50 && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 font-medium mb-1">🚨 High Upheld Rate</p>
              <p className="text-sm text-slate-400">
                {analytics.upheldRate}% complaints upheld. Focus on operator quality training.
              </p>
            </div>
          )}
          {parseFloat(analytics?.avgResolutionTime || 0) > 48 && (
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-orange-400 font-medium mb-1">⏰ Slow Resolution</p>
              <p className="text-sm text-slate-400">
                Average resolution {formatHours(analytics.avgResolutionTime)}. Streamline investigation process.
              </p>
            </div>
          )}
          {(!analytics?.pendingCount || analytics.pendingCount <= 10) && 
           parseFloat(analytics?.upheldRate || 0) <= 50 && 
           parseFloat(analytics?.avgResolutionTime || 0) <= 48 && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-green-400 font-medium mb-1">✅ Good Performance</p>
              <p className="text-sm text-slate-400">
                Complaint metrics are healthy. Continue monitoring trends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
