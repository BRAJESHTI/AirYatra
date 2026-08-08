import React, { useState, useEffect } from 'react';
import { 
  BarChart3, MapPin, Building2, Users, Plane, TrendingUp, AlertTriangle, 
  Clock, IndianRupee, Calendar, Filter, Download, RefreshCw,
  Flag, CheckCircle, XCircle, Star, FileSpreadsheet, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportsAPI } from '@/services/api';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    from_date: '',
    to_date: ''
  });
  
  // Report data states
  const [summary, setSummary] = useState(null);
  const [routeReport, setRouteReport] = useState([]);
  const [stateReport, setStateReport] = useState([]);
  const [districtReport, setDistrictReport] = useState([]);
  const [operatorReport, setOperatorReport] = useState([]);
  const [cancellationReport, setCancellationReport] = useState([]);
  const [pilotDutyReport, setPilotDutyReport] = useState({ pilots: [], summary: {} });
  const [pilotFeedback, setPilotFeedback] = useState([]);
  const [settlementByOperator, setSettlementByOperator] = useState({ operators: [], summary: {} });
  const [settlementByState, setSettlementByState] = useState([]);
  const [settlementByPeriod, setSettlementByPeriod] = useState([]);
  const [periodType, setPeriodType] = useState('monthly');
  const [exporting, setExporting] = useState(null);

  // Excel Export Functions
  const exportToExcel = async (reportType) => {
    setExporting(reportType);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (dateFilter.from_date) params.append('start_date', dateFilter.from_date);
      if (dateFilter.to_date) params.append('end_date', dateFilter.to_date);
      
      const endpoint = reportType === 'bookings' 
        ? `/api/reports/export/bookings?${params}` 
        : reportType === 'finance' 
        ? `/api/reports/export/finance?${params}`
        : reportType === 'refunds'
        ? `/api/reports/export/refunds?${params}`
        : `/api/reports/export/customers?${params}`;
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AirYatra_${reportType}_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded!`);
    } catch (error) {
      toast.error('Failed to export report');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, dateFilter]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter.from_date) params.from_date = dateFilter.from_date;
      if (dateFilter.to_date) params.to_date = dateFilter.to_date;

      switch (activeTab) {
        case 'summary':
          const summaryRes = await reportsAPI.getReportsSummary(params);
          setSummary(summaryRes.data);
          break;
        case 'routes':
          const routeRes = await reportsAPI.getBookingsByRoute(params);
          setRouteReport(routeRes.data.routes || []);
          break;
        case 'states':
          const stateRes = await reportsAPI.getBookingsByState(params);
          setStateReport(stateRes.data.states || []);
          break;
        case 'districts':
          const districtRes = await reportsAPI.getBookingsByDistrict(params);
          setDistrictReport(districtRes.data.districts || []);
          break;
        case 'operators':
          const opRes = await reportsAPI.getOperatorPerformance(params);
          setOperatorReport(opRes.data.operators || []);
          break;
        case 'cancellations':
          const cancelRes = await reportsAPI.getOperatorCancellations(params);
          setCancellationReport(cancelRes.data.cancellations || []);
          break;
        case 'pilots':
          const pilotRes = await reportsAPI.getPilotDutyHours(params);
          setPilotDutyReport(pilotRes.data);
          break;
        case 'feedback':
          const feedbackRes = await reportsAPI.getPilotFeedback(params);
          setPilotFeedback(feedbackRes.data.feedback || []);
          break;
        case 'settlement-operator':
          const settleOpRes = await reportsAPI.getSettlementsByOperator(params);
          setSettlementByOperator(settleOpRes.data);
          break;
        case 'settlement-state':
          const settleStateRes = await reportsAPI.getSettlementsByState(params);
          setSettlementByState(settleStateRes.data.states || []);
          break;
        case 'settlement-period':
          const periodParams = { ...params, period: periodType };
          const periodRes = await reportsAPI.getSettlementsByPeriod(periodParams);
          setSettlementByPeriod(periodRes.data.periods || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'routes', label: 'Routes', icon: Plane },
    { id: 'states', label: 'States', icon: MapPin },
    { id: 'districts', label: 'Districts', icon: MapPin },
    { id: 'operators', label: 'Operators', icon: Building2 },
    { id: 'cancellations', label: 'Cancellations', icon: XCircle },
    { id: 'pilots', label: 'Pilot Duty', icon: Users },
    { id: 'feedback', label: 'Pilot Feedback', icon: Star },
    { id: 'settlement-operator', label: 'Settlement (Operator)', icon: IndianRupee },
    { id: 'settlement-state', label: 'Settlement (State)', icon: IndianRupee },
    { id: 'settlement-period', label: 'Settlement (Period)', icon: Calendar },
  ];

  const renderDutyFlag = (flag) => {
    const flagColors = {
      red: 'bg-red-500',
      orange: 'bg-orange-500',
      green: 'bg-green-500'
    };
    return (
      <div className={`w-4 h-4 rounded-full ${flagColors[flag]}`} title={flag.toUpperCase()} />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
        <Button onClick={loadReportData} variant="outline" className="border-orange-500 text-orange-400">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Excel Export Buttons */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            <span className="text-white font-medium">Excel Export / एक्सेल डाउनलोड</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => exportToExcel('bookings')}
              disabled={exporting === 'bookings'}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              {exporting === 'bookings' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Bookings
            </Button>
            <Button 
              onClick={() => exportToExcel('finance')}
              disabled={exporting === 'finance'}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {exporting === 'finance' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Finance
            </Button>
            <Button 
              onClick={() => exportToExcel('refunds')}
              disabled={exporting === 'refunds'}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              size="sm"
            >
              {exporting === 'refunds' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Refunds
            </Button>
            <Button 
              onClick={() => exportToExcel('customers')}
              disabled={exporting === 'customers'}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              {exporting === 'customers' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Customers
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">Filter by Date:</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-slate-400">From:</Label>
            <Input
              type="date"
              value={dateFilter.from_date}
              onChange={(e) => setDateFilter({ ...dateFilter, from_date: e.target.value })}
              className="bg-slate-800 border-slate-700 w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-slate-400">To:</Label>
            <Input
              type="date"
              value={dateFilter.to_date}
              onChange={(e) => setDateFilter({ ...dateFilter, to_date: e.target.value })}
              className="bg-slate-800 border-slate-700 w-40"
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setDateFilter({ from_date: '', to_date: '' })}
            className="text-slate-400"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading report data...</div>
      ) : (
        <>
          {/* Summary */}
          {activeTab === 'summary' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Total Bookings</div>
                  <div className="text-2xl font-bold text-white">{summary.bookings.total}</div>
                  <div className="text-green-400 text-sm">{summary.bookings.completion_rate}% completed</div>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.revenue.total)}</div>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Active Operators</div>
                  <div className="text-2xl font-bold text-white">{summary.operators.active}</div>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Total Pilots</div>
                  <div className="text-2xl font-bold text-white">{summary.pilots.total}</div>
                </div>
              </div>

              {/* Pilot Duty Flags */}
              <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Pilot Duty Status</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <span className="text-red-400 font-semibold">Red Flag (&gt;12 hrs)</span>
                    </div>
                    <div className="text-3xl font-bold text-red-400 mt-2">{summary.pilots.red_flag}</div>
                    <div className="text-red-400/60 text-sm">Rest Required</div>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-orange-500" />
                      <span className="text-orange-400 font-semibold">Orange Flag (8-12 hrs)</span>
                    </div>
                    <div className="text-3xl font-bold text-orange-400 mt-2">{summary.pilots.orange_flag}</div>
                    <div className="text-orange-400/60 text-sm">Approaching Limit</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span className="text-green-400 font-semibold">Green Flag (&lt;8 hrs)</span>
                    </div>
                    <div className="text-3xl font-bold text-green-400 mt-2">{summary.pilots.green_flag}</div>
                    <div className="text-green-400/60 text-sm">Normal</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Routes Report */}
          {activeTab === 'routes' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Top Routes by Bookings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">Route</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Bookings</th>
                      <th className="text-right py-3 px-4 text-slate-400">Completed</th>
                      <th className="text-right py-3 px-4 text-slate-400">Cancelled</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Revenue</th>
                      <th className="text-right py-3 px-4 text-slate-400">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeReport.map((route, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-3 px-4">
                          <div className="text-white">{route.from_location} → {route.to_location}</div>
                          <div className="text-slate-500 text-xs">{route.from_state} → {route.to_state}</div>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-semibold">{route.total_bookings}</td>
                        <td className="py-3 px-4 text-right text-green-400">{route.completed_bookings}</td>
                        <td className="py-3 px-4 text-right text-red-400">{route.cancelled_bookings}</td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(route.total_revenue)}</td>
                        <td className="py-3 px-4 text-right text-slate-400">{formatCurrency(route.avg_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* States Report */}
          {activeTab === 'states' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Bookings by State</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">State</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Bookings</th>
                      <th className="text-right py-3 px-4 text-slate-400">Completed</th>
                      <th className="text-right py-3 px-4 text-slate-400">Cancelled</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateReport.map((state, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-3 px-4 text-white font-medium">{state.state}</td>
                        <td className="py-3 px-4 text-right text-white">{state.total_bookings}</td>
                        <td className="py-3 px-4 text-right text-green-400">{state.completed}</td>
                        <td className="py-3 px-4 text-right text-red-400">{state.cancelled}</td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(state.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Districts Report */}
          {activeTab === 'districts' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Bookings by District</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">State</th>
                      <th className="text-left py-3 px-4 text-slate-400">District</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Bookings</th>
                      <th className="text-right py-3 px-4 text-slate-400">Completed</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districtReport.map((district, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-3 px-4 text-slate-400">{district.state}</td>
                        <td className="py-3 px-4 text-white font-medium">{district.district}</td>
                        <td className="py-3 px-4 text-right text-white">{district.total_bookings}</td>
                        <td className="py-3 px-4 text-right text-green-400">{district.completed}</td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(district.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Operators Report */}
          {activeTab === 'operators' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Operator Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">Operator</th>
                      <th className="text-right py-3 px-4 text-slate-400">Quotes Sent</th>
                      <th className="text-right py-3 px-4 text-slate-400">Accepted</th>
                      <th className="text-right py-3 px-4 text-slate-400">Completed</th>
                      <th className="text-right py-3 px-4 text-slate-400">Cancelled</th>
                      <th className="text-right py-3 px-4 text-slate-400">Revenue</th>
                      <th className="text-right py-3 px-4 text-slate-400">Accept Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatorReport.map((op, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{op.company_name}</div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            op.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                          }`}>{op.status}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-white">{op.total_quotes_sent}</td>
                        <td className="py-3 px-4 text-right text-blue-400">{op.quotes_accepted}</td>
                        <td className="py-3 px-4 text-right text-green-400">{op.bookings_completed}</td>
                        <td className="py-3 px-4 text-right text-red-400">{op.cancelled_after_accept}</td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(op.total_revenue)}</td>
                        <td className="py-3 px-4 text-right text-orange-400">{op.acceptance_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cancellations Report */}
          {activeTab === 'cancellations' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Operator Cancellations After Acceptance
              </h3>
              {cancellationReport.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No cancellations found</div>
              ) : (
                <div className="space-y-4">
                  {cancellationReport.map((cancel, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-semibold">{cancel.company_name}</div>
                          <div className="text-red-400 text-sm">
                            {cancel.cancellation_count} cancellation(s) after accepting booking
                          </div>
                        </div>
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {cancel.cancellation_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pilot Duty Hours */}
          {activeTab === 'pilots' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Total Pilots</div>
                  <div className="text-2xl font-bold text-white">{pilotDutyReport.summary.total_pilots}</div>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-red-400 text-sm">Red Flag (&gt;12 hrs)</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">{pilotDutyReport.summary.red_flag_count}</div>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-orange-400 text-sm">Orange Flag (8-12 hrs)</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-400">{pilotDutyReport.summary.orange_flag_count}</div>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-green-400 text-sm">Green Flag (&lt;8 hrs)</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">{pilotDutyReport.summary.green_flag_count}</div>
                </div>
              </div>

              {/* Pilot List */}
              <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Pilot Duty Hours (Last 24 hrs)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400">Pilot Name</th>
                        <th className="text-left py-3 px-4 text-slate-400">License</th>
                        <th className="text-right py-3 px-4 text-slate-400">Total Flights</th>
                        <th className="text-right py-3 px-4 text-slate-400">Total Hours</th>
                        <th className="text-right py-3 px-4 text-slate-400">Last 24h Hours</th>
                        <th className="text-left py-3 px-4 text-slate-400">Duty Status</th>
                        <th className="text-right py-3 px-4 text-slate-400">Avg Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pilotDutyReport.pilots.map((pilot, idx) => (
                        <tr key={idx} className={`border-b border-slate-800 ${
                          pilot.duty_flag === 'red' ? 'bg-red-500/5' :
                          pilot.duty_flag === 'orange' ? 'bg-orange-500/5' : ''
                        }`}>
                          <td className="py-3 px-4">{renderDutyFlag(pilot.duty_flag)}</td>
                          <td className="py-3 px-4 text-white font-medium">{pilot.pilot_name}</td>
                          <td className="py-3 px-4 text-slate-400">{pilot.license_number}</td>
                          <td className="py-3 px-4 text-right text-white">{pilot.total_flights}</td>
                          <td className="py-3 px-4 text-right text-white">{pilot.total_flight_hours} hrs</td>
                          <td className="py-3 px-4 text-right">
                            <span className={
                              pilot.duty_flag === 'red' ? 'text-red-400 font-bold' :
                              pilot.duty_flag === 'orange' ? 'text-orange-400 font-bold' :
                              'text-green-400'
                            }>
                              {pilot.last_24h_hours} hrs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-sm">{pilot.duty_status}</td>
                          <td className="py-3 px-4 text-right">
                            {pilot.avg_rating > 0 && (
                              <span className="flex items-center justify-end gap-1 text-yellow-400">
                                <Star className="h-4 w-4 fill-current" />
                                {pilot.avg_rating}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Pilot Feedback */}
          {activeTab === 'feedback' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Pilot Feedback</h3>
              {pilotFeedback.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No feedback found</div>
              ) : (
                <div className="space-y-4">
                  {pilotFeedback.map((fb, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-medium">{fb.pilot_name}</div>
                          <div className="flex items-center gap-1 mt-1">
                            {[1,2,3,4,5].map(star => (
                              <Star key={star} className={`h-4 w-4 ${
                                star <= fb.rating ? 'text-yellow-400 fill-current' : 'text-slate-600'
                              }`} />
                            ))}
                          </div>
                        </div>
                        <span className="text-slate-400 text-sm">{new Date(fb.created_at).toLocaleDateString()}</span>
                      </div>
                      {fb.comment && <p className="text-slate-300 mt-2">{fb.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settlement by Operator */}
          {activeTab === 'settlement-operator' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-sm">Total Revenue</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(settlementByOperator.summary.total_revenue || 0)}</div>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="text-orange-400 text-sm">Platform Commission</div>
                  <div className="text-2xl font-bold text-orange-400">{formatCurrency(settlementByOperator.summary.total_platform_commission || 0)}</div>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-green-400 text-sm">Total Settled</div>
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(settlementByOperator.summary.total_settled || 0)}</div>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-yellow-400 text-sm">Pending Settlement</div>
                  <div className="text-2xl font-bold text-yellow-400">{formatCurrency(settlementByOperator.summary.total_pending || 0)}</div>
                </div>
              </div>

              {/* Table */}
              <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Settlement by Operator</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400">Operator</th>
                        <th className="text-right py-3 px-4 text-slate-400">Bookings</th>
                        <th className="text-right py-3 px-4 text-slate-400">Revenue</th>
                        <th className="text-right py-3 px-4 text-slate-400">Commission</th>
                        <th className="text-right py-3 px-4 text-slate-400">Operator Earnings</th>
                        <th className="text-right py-3 px-4 text-slate-400">Settled</th>
                        <th className="text-right py-3 px-4 text-slate-400">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementByOperator.operators.map((op, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="py-3 px-4">
                            <div className="text-white font-medium">{op.company_name}</div>
                            <div className="text-slate-500 text-xs">{op.state}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-white">{op.total_bookings}</td>
                          <td className="py-3 px-4 text-right text-white">{formatCurrency(op.total_revenue)}</td>
                          <td className="py-3 px-4 text-right text-orange-400">{formatCurrency(op.platform_commission)}</td>
                          <td className="py-3 px-4 text-right text-blue-400">{formatCurrency(op.operator_earnings)}</td>
                          <td className="py-3 px-4 text-right text-green-400">{formatCurrency(op.total_settled)}</td>
                          <td className="py-3 px-4 text-right text-yellow-400">{formatCurrency(op.pending_settlement)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settlement by State */}
          {activeTab === 'settlement-state' && (
            <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Settlement by State</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">State</th>
                      <th className="text-right py-3 px-4 text-slate-400">Bookings</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total Revenue</th>
                      <th className="text-right py-3 px-4 text-slate-400">Platform Commission</th>
                      <th className="text-right py-3 px-4 text-slate-400">Operator Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementByState.map((state, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-3 px-4 text-white font-medium">{state.state}</td>
                        <td className="py-3 px-4 text-right text-white">{state.total_bookings}</td>
                        <td className="py-3 px-4 text-right text-white">{formatCurrency(state.total_revenue)}</td>
                        <td className="py-3 px-4 text-right text-orange-400">{formatCurrency(state.platform_commission)}</td>
                        <td className="py-3 px-4 text-right text-green-400">{formatCurrency(state.operator_earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settlement by Period */}
          {activeTab === 'settlement-period' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="text-slate-400">Period Type:</Label>
                <select
                  value={periodType}
                  onChange={(e) => { setPeriodType(e.target.value); }}
                  className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Settlement by {periodType === 'monthly' ? 'Month' : 'Year'}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400">Period</th>
                        <th className="text-right py-3 px-4 text-slate-400">Bookings</th>
                        <th className="text-right py-3 px-4 text-slate-400">Total Revenue</th>
                        <th className="text-right py-3 px-4 text-slate-400">Platform Commission</th>
                        <th className="text-right py-3 px-4 text-slate-400">Operator Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementByPeriod.map((period, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="py-3 px-4 text-white font-medium">{period.period}</td>
                          <td className="py-3 px-4 text-right text-white">{period.total_bookings}</td>
                          <td className="py-3 px-4 text-right text-white">{formatCurrency(period.total_revenue)}</td>
                          <td className="py-3 px-4 text-right text-orange-400">{formatCurrency(period.platform_commission)}</td>
                          <td className="py-3 px-4 text-right text-green-400">{formatCurrency(period.operator_earnings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ReportsDashboard;
