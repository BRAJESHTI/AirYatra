import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw,
  Calendar, FileText, Bell, Target, AlertCircle, ChevronRight, BarChart3,
  Building2, Receipt, CreditCard, Activity, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import api from '@/services/apiClient';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const complianceTypes = [
  { key: 'GST', label: 'GST', icon: Receipt, color: 'blue' },
  { key: 'TDS', label: 'TDS', icon: FileText, color: 'purple' },
  { key: 'PF', label: 'PF', icon: Building2, color: 'green' },
  { key: 'ESIC', label: 'ESIC', icon: Shield, color: 'orange' },
  { key: 'PT', label: 'PT', icon: CreditCard, color: 'yellow' },
  { key: 'IT', label: 'IT', icon: TrendingUp, color: 'red' }
];

export default function ComplianceDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, calendarRes] = await Promise.all([
        api.get('/finance/advanced/compliance/dashboard'),
        api.get('/finance/advanced/compliance/calendar')
      ]);
      setDashboardData(dashRes.data);
      setCalendar(calendarRes.data.calendar_events || []);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const { 
    compliance_score, 
    overall_status, 
    compliance_by_type, 
    critical_deadlines, 
    summary 
  } = dashboardData || {};

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'overdue': return <AlertTriangle className="h-5 w-5 text-red-400" />;
      default: return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="compliance-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-400" />
            Compliance Dashboard</h1>
          <p className="text-slate-400 mt-1">Unified view of all statutory compliance</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setRefreshing(true); fetchData(); }}
          disabled={refreshing}
          className="border-slate-600"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {critical_deadlines && critical_deadlines.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-red-400 animate-pulse" />
            <h3 className="text-white font-semibold">Critical Deadlines</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {critical_deadlines.slice(0, 6).map((deadline, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-lg ${
                  deadline.urgency === 'critical' ? 'bg-red-500/30' : 'bg-yellow-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium">{deadline.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    deadline.days_remaining <= 3 ? 'bg-red-500' : 'bg-yellow-500'
                  } text-white`}>
                    {deadline.days_remaining} days
                  </span>
                </div>
                <p className="text-sm text-slate-300">{deadline.period}</p>
                <p className="text-lg font-bold text-white">{formatINR(deadline.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Score Card */}
      <div className="grid grid-cols-3 gap-6">
        {/* Compliance Score */}
        <Card className={`col-span-1 border-2 ${
          overall_status === 'good' ? 'bg-gradient-to-br from-green-900/30 to-green-950/50 border-green-500/50' :
          overall_status === 'warning' ? 'bg-gradient-to-br from-yellow-900/30 to-yellow-950/50 border-yellow-500/50' :
          'bg-gradient-to-br from-red-900/30 to-red-950/50 border-red-500/50'
        }`}>
          <CardContent className="p-6 text-center">
            <Target className={`h-12 w-12 mx-auto mb-4 ${
              overall_status === 'good' ? 'text-green-400' :
              overall_status === 'warning' ? 'text-yellow-400' :
              'text-red-400'
            }`} />
            <p className={`text-6xl font-bold ${getScoreColor(compliance_score)}`}>
              {compliance_score}
            </p>
            <p className="text-slate-400 mt-2">Compliance Score</p>
            <div className="mt-4">
              <Progress 
                value={compliance_score} 
                className="h-2"
              />
            </div>
            <p className={`text-sm mt-3 font-medium ${
              overall_status === 'good' ? 'text-green-400' :
              overall_status === 'warning' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {overall_status === 'good' ? '✓ All Compliant' :
               overall_status === 'warning' ? '⚠ Needs Attention' :
               '⚠ Critical Issues'}
            </p>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card className="col-span-2 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Compliance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <Clock className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{summary?.total_pending || 0}</p>
                <p className="text-xs text-slate-400">Total Pending</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{summary?.overdue_count || 0}</p>
                <p className="text-xs text-slate-400">Overdue</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <Receipt className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{summary?.pending_vendor_tds || 0}</p>
                <p className="text-xs text-slate-400">Vendor TDS</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <TrendingUp className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{formatINR(summary?.total_pending_amount)}</p>
                <p className="text-xs text-slate-400">Amount Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance by Type */}
      <div className="grid grid-cols-6 gap-4">
        {complianceTypes.map(type => {
          const data = compliance_by_type?.[type.key] || {};
          const Icon = type.icon;
          
          return (
            <Card 
              key={type.key}
              className={`bg-slate-800/50 border-slate-700 hover:border-slate-500 transition-colors ${
                data.status === 'overdue' ? 'border-red-500/50' :
                data.status === 'pending' ? 'border-yellow-500/50' :
                ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-${type.color}-500/20`}>
                    <Icon className={`h-5 w-5 text-${type.color}-400`} />
                  </div>
                  {getStatusIcon(data.status)}
                </div>
                <h4 className="text-white font-semibold">{type.label}</h4>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Pending</span>
                    <span className="text-white">{data.pending_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Amount</span>
                    <span className="text-white">{formatINR(data.pending_amount)}</span>
                  </div>
                  {data.overdue_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-400">Overdue</span>
                      <span className="text-red-400 font-semibold">{data.overdue_count}</span>
                    </div>
                  )}
                </div>
                {data.next_due && (
                  <p className="text-xs text-slate-500 mt-2">
                    Next: {new Date(data.next_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Compliance Calendar */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-400" />
            Compliance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-sm">
            {['GST', 'TDS', 'PF', 'ESIC', 'PT', 'IT', 'Date'].map(header => (
              <div key={header} className="text-slate-400 font-medium py-2">{header}</div>
            ))}
          </div>
          <div className="space-y-2">
            {/* Group calendar events by date */}
            {[...new Set(calendar.map(c => c.date))].slice(0, 10).map(date => {
              const eventsForDate = calendar.filter(c => c.date === date);
              return (
                <div key={date} className="grid grid-cols-7 gap-2 py-2 border-t border-slate-700">
                  {complianceTypes.map(type => {
                    const event = eventsForDate.find(e => e.type === type.key);
                    if (!event) return <div key={type.key} className="text-center">-</div>;
                    return (
                      <div 
                        key={type.key}
                        className={`text-center py-1 px-2 rounded ${
                          event.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          event.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {event.has_challan ? (
                          <span className="text-xs">{formatINR(event.amount)}</span>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-center text-slate-300 text-sm">
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
