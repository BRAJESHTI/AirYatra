import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, Plane, AlertTriangle, CheckCircle, Clock, RefreshCw,
  FileText, Eye, Download, Search, Calendar, Loader2, XCircle,
  TrendingUp, Users, Building2, Bell, ChevronRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ SEVERITY BADGE ============
const SeverityBadge = ({ severity }) => {
  const config = {
    expired: { color: 'bg-red-600 text-white', label: 'EXPIRED', icon: XCircle },
    critical: { color: 'bg-red-500 text-white', label: 'Critical', icon: AlertTriangle },
    high: { color: 'bg-orange-500 text-white', label: 'High', icon: AlertTriangle },
    warning: { color: 'bg-yellow-500 text-black', label: 'Warning', icon: Clock },
    attention: { color: 'bg-blue-500 text-white', label: 'Attention', icon: Bell },
    info: { color: 'bg-slate-500 text-white', label: 'Info', icon: FileText }
  };
  
  const c = config[severity] || config.info;
  const Icon = c.icon;
  
  return (
    <Badge className={`${c.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
};

// ============ VERIFICATION STATUS BADGE ============
const VerificationStatusBadge = ({ status }) => {
  const config = {
    pending: { emoji: '🔴', label: 'Pending Verification', color: 'bg-red-500/20 text-red-400' },
    under_review: { emoji: '🟡', label: 'Under Review', color: 'bg-yellow-500/20 text-yellow-400' },
    verified: { emoji: '🟢', label: 'Verified', color: 'bg-green-500/20 text-green-400' },
    premium_verified: { emoji: '🔵', label: 'Premium Verified', color: 'bg-blue-500/20 text-blue-400' },
    suspended: { emoji: '⚫', label: 'Suspended', color: 'bg-gray-500/20 text-gray-400' }
  };
  
  const c = config[status] || config.pending;
  
  return (
    <Badge className={c.color}>
      <span className="mr-1">{c.emoji}</span>
      {c.label}
    </Badge>
  );
};

// ============ MAIN COMPLIANCE DASHBOARD ============
const ComplianceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [categories, setCategories] = useState(null);
  const [reports, setReports] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [daysThreshold, setDaysThreshold] = useState(30);
  const [runningCheck, setRunningCheck] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/compliance/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to load compliance dashboard');
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/compliance/alerts?days_threshold=${daysThreshold}`;
      if (severityFilter) url += `&severity=${severityFilter}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, [severityFilter, daysThreshold]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/compliance/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/compliance/reports?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  }, []);

  const runDailyCheck = async () => {
    setRunningCheck(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/compliance/run-daily-check`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Compliance check complete! ${response.data.summary.total_alerts} alerts found.`);
      fetchDashboard();
      fetchAlerts();
      fetchReports();
    } catch (error) {
      toast.error('Failed to run compliance check');
    } finally {
      setRunningCheck(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchAlerts(), fetchCategories(), fetchReports()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchDashboard, fetchAlerts, fetchCategories, fetchReports]);

  useEffect(() => {
    fetchAlerts();
  }, [severityFilter, daysThreshold, fetchAlerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="compliance-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-400" />
            AI Compliance Monitor</h2>
          <p className="text-slate-400 text-sm mt-1">
            Enterprise-level aircraft verification and document compliance tracking
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { fetchDashboard(); fetchAlerts(); }}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button
            onClick={runDailyCheck}
            disabled={runningCheck}
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="run-compliance-check-btn"
          >
            {runningCheck ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><Shield className="h-4 w-4 mr-2" /> Run Compliance Check</>
            )}
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <Plane className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">{dashboardData.aircraft.total}</div>
              <div className="text-slate-400 text-sm">Total Aircraft</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-400">{dashboardData.aircraft.verified}</div>
              <div className="text-slate-400 text-sm">Verified</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-yellow-400">{dashboardData.aircraft.pending}</div>
              <div className="text-slate-400 text-sm">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-red-400">{dashboardData.aircraft.suspended}</div>
              <div className="text-slate-400 text-sm">Suspended</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-orange-500/50 border-2">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-orange-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-orange-400">{dashboardData.compliance_alerts.insurance_expiring_30d}</div>
              <div className="text-slate-400 text-sm">Insurance Expiring</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-red-500/50 border-2">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-red-400">{dashboardData.compliance_alerts.maintenance_due_30d}</div>
              <div className="text-slate-400 text-sm">Maintenance Due</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last Check Info */}
      {dashboardData?.last_check?.run_at && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-white font-medium">Last Compliance Check</p>
                  <p className="text-slate-400 text-sm">
                    {new Date(dashboardData.last_check.run_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-orange-400 font-medium">{dashboardData.last_check.alerts_found} Alerts Found</p>
                <p className="text-slate-400 text-sm">{dashboardData.last_check.aircraft_hidden} Aircraft Auto-Hidden</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="alerts" className="data-[state=active]:bg-orange-500">
            <AlertTriangle className="h-4 w-4 mr-2" /> Active Alerts
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-orange-500">
            <FileText className="h-4 w-4 mr-2" /> Document Categories
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-orange-500">
            <TrendingUp className="h-4 w-4 mr-2" /> Check Reports
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
            >
              <option value="">All Severities</option>
              <option value="expired">Expired</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
            </select>
            <select
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
              className="h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
            >
              <option value={7}>Next 7 days</option>
              <option value={15}>Next 15 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </div>

          {/* Alerts List */}
          {alerts.length === 0 ? (
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
                <p className="text-slate-400">No compliance alerts in the selected time range</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Card key={alert.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-800 rounded-lg">
                          <Plane className="h-6 w-6 text-orange-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium">{alert.aircraft_registration}</h4>
                            <SeverityBadge severity={alert.severity} />
                          </div>
                          <p className="text-slate-400 text-sm">{alert.manufacturer_model}</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {alert.document_label} • Expires: {alert.expiry_date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${alert.days_remaining <= 0 ? 'text-red-400' : alert.days_remaining <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {alert.days_remaining <= 0 ? 'EXPIRED' : `${alert.days_remaining} days left`}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {alert.is_published ? '🟢 Published' : '🔴 Hidden'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          {categories && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categories.document_categories || {}).map(([key, category]) => (
                <Card key={key} className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-lg">{category.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {category.types.map((type) => (
                        <li key={type.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{type.label}</span>
                          <div className="flex gap-2">
                            {type.required && <Badge className="bg-orange-500 text-white text-xs">Required</Badge>}
                            {type.has_expiry && <Badge className="bg-blue-500 text-white text-xs">Expiry</Badge>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Photo Categories */}
          {categories?.photo_categories && (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Required Aircraft Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {categories.photo_categories.map((photo) => (
                    <div key={photo.id} className={`p-3 rounded-lg text-center ${photo.required ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-800'}`}>
                      <p className="text-white text-sm">{photo.label}</p>
                      {photo.required && <Badge className="mt-1 bg-orange-500 text-white text-xs">Required</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          {reports.length === 0 ? (
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="py-12 text-center">
                <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Reports Yet</h3>
                <p className="text-slate-400">Run your first compliance check to generate a report</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id} className="bg-slate-900 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {new Date(report.run_at).toLocaleDateString('en-IN', { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                          })}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {report.total_aircraft_checked} aircraft checked
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-red-400 text-xl font-bold">{report.alerts_by_severity?.expired || 0}</p>
                          <p className="text-slate-500 text-xs">Expired</p>
                        </div>
                        <div>
                          <p className="text-orange-400 text-xl font-bold">{report.alerts_by_severity?.critical || 0}</p>
                          <p className="text-slate-500 text-xs">Critical</p>
                        </div>
                        <div>
                          <p className="text-yellow-400 text-xl font-bold">{report.alerts_by_severity?.warning || 0}</p>
                          <p className="text-slate-500 text-xs">Warning</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white">{report.operators_notified} operators notified</p>
                        <p className="text-slate-400 text-sm">{report.aircraft_auto_hidden} aircraft hidden</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComplianceDashboard;
