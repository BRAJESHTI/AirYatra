import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, MousePointer2, TrendingUp, ExternalLink, 
  RefreshCw, Calendar, Filter, Loader2, Info, Flame,
  ShoppingCart, User, Gift, HelpCircle, Mail, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Email Click Heatmap Dashboard
 * Shows which links in emails get the most clicks
 */
export default function EmailClickHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [viewMode, setViewMode] = useState('bar'); // 'bar', 'pie', 'trend'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/templates/email/click-heatmap?days=${days}`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load click heatmap data');
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Heat level colors
  const getHeatColor = (level) => {
    switch (level) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f97316';
      case 'mild': return '#eab308';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  // Category icons
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'booking': return <ShoppingCart className="h-4 w-4" />;
      case 'account': return <User className="h-4 w-4" />;
      case 'promo': return <Gift className="h-4 w-4" />;
      case 'support': return <HelpCircle className="h-4 w-4" />;
      case 'unsubscribe': return <Mail className="h-4 w-4" />;
      case 'app_download': return <Download className="h-4 w-4" />;
      default: return <ExternalLink className="h-4 w-4" />;
    }
  };

  // Prepare chart data
  const chartData = data?.heatmap_data?.slice(0, 10).map(item => ({
    name: item.url.length > 30 ? item.url.substring(0, 30) + '...' : item.url,
    clicks: item.total_clicks,
    percentage: item.percentage,
    heat: item.heat_level,
    fullUrl: item.url
  })) || [];

  const categoryData = data?.category_summary 
    ? Object.entries(data.category_summary).map(([name, stats]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        clicks: stats.clicks,
        urls: stats.urls
      }))
    : [];

  const trendData = data?.daily_trend || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-click-heatmap">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Email Click Heatmap
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            See which email links get the most engagement
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Days Filter */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          
          {/* View Mode Toggle */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1 rounded ${viewMode === 'bar' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('pie')}
              className={`px-3 py-1 rounded ${viewMode === 'pie' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('trend')}
              className={`px-3 py-1 rounded ${viewMode === 'trend' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>
          
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <MousePointer2 className="h-4 w-4" />
            Total Clicks
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            {data?.total_clicks?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <ExternalLink className="h-4 w-4" />
            Unique Links
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            {data?.unique_urls_clicked || 0}
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <TrendingUp className="h-4 w-4" />
            Avg per Link
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            {data?.insights?.avg_clicks_per_url || 0}
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Flame className="h-4 w-4" />
            Top Category
          </div>
          <p className="text-xl font-bold text-orange-400 mt-2 capitalize">
            {data?.insights?.most_clicked_category?.replace(/_/g, ' ') || 'N/A'}
          </p>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        {data?.total_clicks === 0 ? (
          <div className="text-center py-12">
            <MousePointer2 className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Click Data Yet</h3>
            <p className="text-slate-400">
              Click tracking will appear here once users start clicking links in your emails.
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'bar' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Top Clicked Links</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" width={200} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value, name) => [value, 'Clicks']}
                    />
                    <Bar dataKey="clicks" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getHeatColor(entry.heat)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === 'pie' && categoryData.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Clicks by Category</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={150}
                      fill="#f97316"
                      dataKey="clicks"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === 'trend' && trendData.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Daily Click Trend</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      dot={{ fill: '#f97316', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detailed Link Table */}
      {data?.heatmap_data?.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">All Tracked Links</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Heat</th>
                  <th className="pb-3 font-medium">Link URL</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Clicks</th>
                  <th className="pb-3 font-medium text-right">%</th>
                  <th className="pb-3 font-medium text-right">Emails</th>
                </tr>
              </thead>
              <tbody>
                {data.heatmap_data.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: getHeatColor(item.heat_level) }}
                        title={item.heat_level}
                      />
                    </td>
                    <td className="py-3">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 max-w-md truncate"
                      >
                        {item.url}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-1 text-slate-300 capitalize">
                        {getCategoryIcon(item.category)}
                        {item.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-white">
                      {item.total_clicks.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {item.percentage}%
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {item.unique_email_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          <p className="font-medium text-blue-400 mb-1">How Click Tracking Works</p>
          <p>
            Every link in your emails is wrapped with a tracking URL. When a recipient clicks, 
            we record the click and redirect them to the original destination. Use this data to 
            optimize your email content and CTAs.
          </p>
        </div>
      </div>
    </div>
  );
}
