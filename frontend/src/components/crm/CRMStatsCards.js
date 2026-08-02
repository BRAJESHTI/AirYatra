/**
 * CRM Dashboard Stats Cards Component
 * Displays key metrics: Total Leads, Hot Leads, Today's Tasks, Monthly Revenue
 */
import React from 'react';
import { Users, Target, ListChecks, TrendingUp } from 'lucide-react';

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm">{title}</p>
        <p className={`text-3xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color?.includes('green') ? 'bg-green-500/20' : color?.includes('orange') ? 'bg-orange-500/20' : color?.includes('blue') ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
        <Icon className={`h-6 w-6 ${color || 'text-slate-400'}`} />
      </div>
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-xs">
        <span className={trend > 0 ? 'text-green-400' : 'text-red-400'}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
        <span className="text-slate-500">vs last month</span>
      </div>
    )}
  </div>
);

const CRMStatsCards = ({ dashboard }) => {
  if (!dashboard) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="crm-stats-cards">
      <StatsCard
        title="Total Leads"
        value={dashboard.total_leads || 0}
        icon={Users}
        color="text-blue-400"
        subtitle={`${dashboard.today_leads || 0} today`}
      />
      <StatsCard
        title="Hot Leads"
        value={dashboard.hot_leads || 0}
        icon={Target}
        color="text-orange-400"
        subtitle="Need immediate attention"
      />
      <StatsCard
        title="Today's Tasks"
        value={dashboard.today_tasks || 0}
        icon={ListChecks}
        color="text-green-400"
        subtitle={`${dashboard.completed_tasks || 0} completed`}
      />
      <StatsCard
        title="Monthly Revenue"
        value={`₹${((dashboard.monthly_revenue || 0) / 100000).toFixed(1)}L`}
        icon={TrendingUp}
        color="text-purple-400"
        subtitle={`${dashboard.won_deals || 0} deals won`}
        trend={dashboard.revenue_trend}
      />
    </div>
  );
};

export default CRMStatsCards;
