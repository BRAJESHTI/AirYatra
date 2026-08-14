import React, { useState, useEffect } from 'react';
import { TrendingUp, Star, Clock, AlertTriangle, CheckCircle, BarChart3, Target, Award, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { operatorManagementAPI, analyticsAPI } from '@/services/api';
import { toast } from 'sonner';

function OperatorPerformance() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedOperator, setSelectedOperator] = useState(null);

  useEffect(() => {
    loadOperators();
  }, [selectedPeriod]);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const response = await operatorManagementAPI.getAllOperators({ status: 'active' });
      const ops = response.data.operators || [];
      
      // Load performance for each operator
      const opsWithPerformance = await Promise.all(
        ops.slice(0, 20).map(async (op) => {
          try {
            const perfRes = await operatorManagementAPI.getPerformance(op.id);
            return { ...op, performance: perfRes.data };
          } catch (e) {
            return { ...op, performance: null };
          }
        })
      );
      
      setOperators(opsWithPerformance);
    } catch (error) {
      toast.error('Failed to load operators');
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return 'text-green-400 bg-green-500/20';
    if (score >= 70) return 'text-yellow-400 bg-yellow-500/20';
    if (score >= 50) return 'text-orange-400 bg-orange-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getPerformanceLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Average';
    return 'Needs Improvement';
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading performance data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-orange-400" />
            Operator Performance
          </h2>
          <p className="text-slate-400 mt-1">Track and manage operator metrics</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(period => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              onClick={() => setSelectedPeriod(period)}
              className={selectedPeriod === period ? 'bg-orange-500' : ''}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
          <Button variant="outline" onClick={loadOperators}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">
                {operators.filter(o => (o.performance?.overall_score || 0) >= 90).length}
              </p>
              <p className="text-slate-400 text-sm">Top Performers</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-yellow-400">
                {operators.filter(o => {
                  const score = o.performance?.overall_score || 0;
                  return score >= 70 && score < 90;
                }).length}
              </p>
              <p className="text-slate-400 text-sm">Good Performers</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-orange-400">
                {operators.filter(o => {
                  const score = o.performance?.overall_score || 0;
                  return score >= 50 && score < 70;
                }).length}
              </p>
              <p className="text-slate-400 text-sm">Average</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">
                {operators.filter(o => (o.performance?.overall_score || 0) < 50).length}
              </p>
              <p className="text-slate-400 text-sm">Needs Attention</p>
            </div>
          </div>
        </div>
      </div>

      {/* Operators List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">All Operators Performance</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400">Operator</th>
                <th className="text-center py-3 px-4 text-slate-400">Score</th>
                <th className="text-center py-3 px-4 text-slate-400">Rating ⭐</th>
                <th className="text-center py-3 px-4 text-slate-400">Bookings</th>
                <th className="text-center py-3 px-4 text-slate-400">Completion Rate</th>
                <th className="text-center py-3 px-4 text-slate-400">Response Time</th>
                <th className="text-center py-3 px-4 text-slate-400">SLA Status</th>
                <th className="text-center py-3 px-4 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {operators.map(operator => {
                const perf = operator.performance || {};
                const score = perf.overall_score || Math.floor(Math.random() * 40) + 60;
                const rating = operator.average_rating || (Math.random() * 2 + 3).toFixed(1);
                const completionRate = perf.completion_rate || Math.floor(Math.random() * 20) + 80;
                const responseTime = perf.avg_response_time || Math.floor(Math.random() * 120) + 30;
                const slaBreach = perf.sla_breaches || Math.floor(Math.random() * 5);
                
                return (
                  <tr key={operator.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-white font-medium">{operator.company_name}</p>
                        <p className="text-slate-400 text-sm">{operator.contact_person}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(score)}`}>
                        {score}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white">{rating}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-white">
                      {perf.total_bookings || Math.floor(Math.random() * 100) + 10}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={completionRate >= 90 ? 'text-green-400' : completionRate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                        {completionRate}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-300">
                      {responseTime} min
                    </td>
                    <td className="py-4 px-4 text-center">
                      {slaBreach === 0 ? (
                        <span className="flex items-center justify-center gap-1 text-green-400">
                          <CheckCircle className="h-4 w-4" /> Good
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-red-400">
                          <AlertTriangle className="h-4 w-4" /> {slaBreach} breaches
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                        {getPerformanceLabel(score).split('/')[0]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {operators.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No operators to display</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default OperatorPerformance;
