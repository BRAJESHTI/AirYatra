import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plane, Clock, Fuel, Wrench, Calendar, AlertTriangle, CheckCircle,
  RefreshCw, BarChart3, TrendingUp, Settings, Activity, Timer
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function OperatorFleetAnalytics({ operator }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('utilization');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/fleet/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load fleet analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours) => {
    return `${hours?.toFixed(1) || 0}h`;
  };

  const getUtilizationColor = (rate) => {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMaintenanceStatus = (status) => {
    switch (status) {
      case 'good': return { label: 'Good', color: 'bg-green-500/20 text-green-400', icon: CheckCircle };
      case 'due_soon': return { label: 'Due Soon', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock };
      case 'overdue': return { label: 'Overdue', color: 'bg-red-500/20 text-red-400', icon: AlertTriangle };
      default: return { label: 'Unknown', color: 'bg-slate-500/20 text-slate-400', icon: Settings };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="fleet-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const fleet = data?.fleet || [];
  const summary = data?.summary || {};
  const utilizationTrend = data?.utilization_trend || [];

  return (
    <div className="space-y-6 p-6" data-testid="fleet-analytics">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-500" />
            Fleet Analytics
          </h1>
          <p className="text-slate-400 mt-1">Monitor aircraft utilization, maintenance & performance</p>
        </div>
        <Button 
          onClick={loadAnalytics} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Aircraft</p>
                <p className="text-3xl font-bold text-white mt-1">{summary.total_aircraft || 0}</p>
                <p className="text-blue-200 text-sm mt-1">{summary.active_aircraft || 0} active</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Plane className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">Avg. Utilization</p>
                <p className="text-3xl font-bold text-white mt-1">{summary.avg_utilization || 0}%</p>
                <p className="text-green-200 text-sm mt-1">This month</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Flight Hours</p>
                <p className="text-3xl font-bold text-white mt-1">{formatHours(summary.total_flight_hours)}</p>
                <p className="text-purple-200 text-sm mt-1">All time</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Timer className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-sm font-medium">Maintenance Due</p>
                <p className="text-3xl font-bold text-white mt-1">{summary.maintenance_due || 0}</p>
                <p className="text-orange-200 text-sm mt-1">Aircraft need attention</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Wrench className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800 border-slate-700 p-1">
          <TabsTrigger 
            value="utilization" 
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            Utilization
          </TabsTrigger>
          <TabsTrigger 
            value="maintenance" 
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            Maintenance
          </TabsTrigger>
          <TabsTrigger 
            value="performance" 
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Utilization Tab */}
        <TabsContent value="utilization" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Utilization Chart */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Monthly Utilization Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {utilizationTrend.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={utilizationTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          formatter={(value) => [`${value}%`, 'Utilization']}
                        />
                        <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No utilization data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aircraft List */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Aircraft Utilization</CardTitle>
                <CardDescription className="text-slate-400">
                  Utilization rate per aircraft this month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fleet.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No aircraft in fleet</p>
                  </div>
                ) : (
                  fleet.map((aircraft, idx) => (
                    <div key={idx} className="bg-slate-900/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Plane className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">{aircraft.registration || aircraft.name}</p>
                            <p className="text-slate-500 text-xs">{aircraft.model || 'Helicopter'}</p>
                          </div>
                        </div>
                        <span className={`text-2xl font-bold ${getUtilizationColor(aircraft.utilization_rate)}`}>
                          {aircraft.utilization_rate || 0}%
                        </span>
                      </div>
                      <Progress value={aircraft.utilization_rate || 0} className="h-2" />
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>{formatHours(aircraft.month_hours)} this month</span>
                        <span>{formatHours(aircraft.total_hours)} total</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-500" />
                Maintenance Schedule
              </CardTitle>
              <CardDescription className="text-slate-400">
                Track maintenance status and upcoming services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fleet.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No aircraft to show</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Aircraft</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Last Service</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Next Due</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">Hours Since</th>
                        <th className="text-center py-3 px-4 text-slate-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map((aircraft, idx) => {
                        const status = getMaintenanceStatus(aircraft.maintenance_status);
                        const StatusIcon = status.icon;
                        return (
                          <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <Plane className="h-5 w-5 text-blue-400" />
                                <div>
                                  <p className="text-white font-medium">{aircraft.registration || aircraft.name}</p>
                                  <p className="text-slate-500 text-xs">{aircraft.model}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-slate-300">
                              {aircraft.last_maintenance || 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-slate-300">
                              {aircraft.next_maintenance || 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-right text-white font-semibold">
                              {formatHours(aircraft.hours_since_maintenance)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <Badge className={`${status.color} border-0`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
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
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-green-500" />
                  Fuel Efficiency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fleet.map((aircraft, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Plane className="h-5 w-5 text-blue-400" />
                      <span className="text-white">{aircraft.registration || aircraft.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-semibold">{aircraft.fuel_efficiency || '150'} L/hr</p>
                      <p className="text-slate-500 text-xs">Avg consumption</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  Flight Hours This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fleet.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fleet.map(a => ({ name: a.registration || a.name, hours: a.month_hours || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          formatter={(value) => [`${value}h`, 'Hours']}
                        />
                        <Bar dataKey="hours" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
