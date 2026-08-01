import React, { useState, useEffect, useCallback } from 'react';
import { Plane, BookOpen, Wrench, AlertTriangle, Plus, Loader2, CheckCircle2, Gauge, Fuel, TrendingUp, Download, UserCheck, BadgeIndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api, { operatorAPI } from '../../services/api';
import { toast } from 'sonner';

const SEV = {
  overdue: { chip: 'bg-red-500/20 text-red-400 border-red-500/40', label: 'OVERDUE' },
  hours_due: { chip: 'bg-orange-500/20 text-orange-400 border-orange-500/40', label: 'HOURS DUE' },
  due_soon: { chip: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', label: 'DUE SOON' },
  hours_soon: { chip: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', label: 'APPROACHING' },
  in_progress: { chip: 'bg-sky-500/20 text-sky-400 border-sky-500/40', label: 'IN PROGRESS' },
};

const EMPTY_LOG = { aircraft_id: '', pilot_id: '', departure_location: '', arrival_location: '', departure_time: '', flight_duration_minutes: '', distance_km: '', fuel_used_liters: '', remarks: '' };
const EMPTY_MAINT = { aircraft_id: '', type: 'routine', description: '', scheduled_date: '', priority: 'medium', estimated_cost: '' };

function OperatorERP() {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [logbook, setLogbook] = useState(null);
  const [aircraftFilter, setAircraftFilter] = useState('');
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [logForm, setLogForm] = useState(EMPTY_LOG);
  const [maintForm, setMaintForm] = useState(EMPTY_MAINT);

  const loadAll = useCallback(async () => {
    try {
      const [ov, an, pl] = await Promise.all([
        api.get('/erp/operator/overview'),
        api.get('/erp/operator/analytics').catch(() => ({ data: null })),
        operatorAPI.getPilots().catch(() => ({ data: { pilots: [] } })),
      ]);
      setOverview(ov.data);
      setAnalytics(an.data);
      setPilots(pl.data.pilots || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to load ERP overview'); }
    setLoading(false);
  }, []);

  const loadLogbook = useCallback(async (acId) => {
    try {
      const res = await api.get('/erp/operator/logbook', { params: acId ? { aircraft_id: acId } : {} });
      setLogbook(res.data);
    } catch (e) { toast.error('Failed to load logbook'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadLogbook(aircraftFilter); }, [aircraftFilter, loadLogbook]);

  const addLog = async () => {
    if (!logForm.aircraft_id || !logForm.pilot_id || !logForm.departure_location || !logForm.arrival_location || !logForm.departure_time || !logForm.distance_km) {
      return toast.error('Aircraft, pilot, route, time aur distance required hai');
    }
    setSaving(true);
    try {
      await api.post('/flight-records/', {
        ...logForm,
        distance_km: Number(logForm.distance_km),
        flight_duration_minutes: Number(logForm.flight_duration_minutes || 0),
        fuel_used_liters: Number(logForm.fuel_used_liters || 0),
      });
      toast.success('Flight log entry added / लॉग एंट्री जुड़ गई');
      setLogOpen(false);
      setLogForm(EMPTY_LOG);
      await Promise.all([loadAll(), loadLogbook(aircraftFilter)]);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add log entry');
    } finally { setSaving(false); }
  };

  const scheduleMaint = async () => {
    if (!maintForm.aircraft_id || !maintForm.description || !maintForm.scheduled_date) {
      return toast.error('Aircraft, description aur date required hai');
    }
    setSaving(true);
    try {
      await api.post('/maintenance/schedule', { ...maintForm, estimated_cost: Number(maintForm.estimated_cost || 0), estimated_hours: 0, assigned_technician: '', parts_required: [] });
      toast.success('Maintenance scheduled / रखरखाव निर्धारित');
      setMaintOpen(false);
      setMaintForm(EMPTY_MAINT);
      await loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to schedule');
    } finally { setSaving(false); }
  };

  const completeMaint = async (alert) => {
    try {
      await api.post(`/erp/operator/maintenance/${alert.maintenance_id}/complete`, {});
      toast.success('Maintenance completed — hours counter reset ✓');
      await loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to complete'); }
  };

  if (loading) return <div className="text-slate-400 flex items-center gap-2 p-6"><Loader2 className="h-4 w-4 animate-spin" />Loading ERP...</div>;
  if (!overview) return null;
  const { kpis, alerts, fleet } = overview;

  const kpiCards = [
    { label: 'Fleet / फ्लीट', value: kpis.fleet_size, icon: Plane, color: 'text-sky-400' },
    { label: 'Flights (month)', value: kpis.flights_this_month, icon: BookOpen, color: 'text-green-400' },
    { label: 'Hours (month)', value: `${kpis.hours_this_month}h`, icon: Gauge, color: 'text-orange-400' },
    { label: 'Revenue (month)', value: analytics ? `₹${(analytics.revenue_this_month || 0).toLocaleString()}` : '—', icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Open Maintenance', value: kpis.open_maintenance, icon: Wrench, color: 'text-yellow-400' },
    { label: 'Critical Alerts', value: kpis.critical_alerts, icon: AlertTriangle, color: kpis.critical_alerts > 0 ? 'text-red-400' : 'text-slate-400' },
  ];

  return (
    <div className="space-y-6" data-testid="operator-erp">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">ERP Command Center / ईआरपी</h1>
          <p className="text-slate-400 text-sm">Digital Flight Logbook + Maintenance Alerts — ek jagah</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setMaintOpen(true)} variant="outline" className="border-yellow-500/50 text-yellow-400 hover:text-yellow-300" data-testid="schedule-maintenance-btn">
            <Wrench className="h-4 w-4 mr-2" />Schedule Maintenance
          </Button>
          <Button onClick={() => setLogOpen(true)} className="bg-sky-500 hover:bg-sky-600" data-testid="add-flight-log-btn">
            <Plus className="h-4 w-4 mr-2" />Add Flight Log
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700" data-testid={`erp-kpi-${k.label.split(' ')[0].toLowerCase()}`}>
            <k.icon className={`h-5 w-5 mb-2 ${k.color}`} />
            <p className="text-2xl font-bold text-white">{k.value}</p>
            <p className="text-slate-400 text-xs">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Advanced Analytics */}
      {analytics && (
        <div className="grid lg:grid-cols-2 gap-4" data-testid="erp-analytics-section">
          {/* Utilization Trend */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5" data-testid="utilization-trend-card">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" />Fleet Utilization — Last 6 Months</h2>
            <div className="flex items-end gap-3 h-36">
              {(() => {
                const maxH = Math.max(1, ...analytics.monthly_trend.map((m) => m.hours));
                return analytics.monthly_trend.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-emerald-400 text-xs font-semibold">{m.hours}h</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all" style={{ height: `${Math.max(4, (m.hours / maxH) * 100)}px` }} title={`${m.flights} flights`} />
                    <span className="text-slate-400 text-xs">{m.label}</span>
                  </div>
                ));
              })()}
            </div>
            <p className="text-slate-500 text-xs mt-2">{analytics.accepted_quotes_this_month} accepted quotes • {analytics.fuel_this_month_liters}L fuel this month</p>
          </div>

          {/* Pilot Duty Hours (FDTL) */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5" data-testid="pilot-duty-card">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><UserCheck className="h-4 w-4 text-sky-400" />Pilot Duty Hours (This Month) — DGCA FDTL Watch</h2>
            {analytics.pilot_hours.length === 0 ? (
              <p className="text-slate-400 text-sm">No pilots added yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.pilot_hours.map((p) => (
                  <div key={p.pilot_id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-2.5 border border-slate-700/60" data-testid={`pilot-hours-${p.pilot_id}`}>
                    <div>
                      <p className="text-white text-sm font-medium">{p.name}</p>
                      <p className="text-slate-500 text-xs">{p.flights} flights • {p.hours}h flown</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div className={`h-full ${p.fdtl_status === 'over_limit' ? 'bg-red-500' : p.fdtl_status === 'watch' ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, p.hours)}%` }} />
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.fdtl_status === 'over_limit' ? 'bg-red-500/20 text-red-400' : p.fdtl_status === 'watch' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {p.fdtl_status === 'over_limit' ? 'OVER 100h' : p.fdtl_status === 'watch' ? 'WATCH' : 'OK'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fuel Efficiency */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5" data-testid="fuel-efficiency-card">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Fuel className="h-4 w-4 text-orange-400" />Fuel Efficiency (6 months)</h2>
            <div className="space-y-2">
              {analytics.fuel_stats.map((f) => (
                <div key={f.aircraft_id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-2.5 border border-slate-700/60">
                  <div>
                    <p className="text-white text-sm font-medium">{f.label}</p>
                    <p className="text-slate-500 text-xs">{f.hours}h • {f.km} km • {f.fuel_liters}L</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 font-bold">{f.liters_per_hour} L/hr</p>
                    <p className="text-slate-500 text-[10px]">burn rate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Costs */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5" data-testid="maintenance-cost-card">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><BadgeIndianRupee className="h-4 w-4 text-yellow-400" />Maintenance Spend</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60 text-center">
                <p className="text-2xl font-bold text-yellow-400">₹{(analytics.maintenance_costs.spent_ytd || 0).toLocaleString()}</p>
                <p className="text-slate-400 text-xs mt-1">Spent this year ({analytics.maintenance_costs.completed_count} completed)</p>
              </div>
              <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60 text-center">
                <p className="text-2xl font-bold text-sky-400">₹{(analytics.maintenance_costs.upcoming_estimate || 0).toLocaleString()}</p>
                <p className="text-slate-400 text-xs mt-1">Upcoming estimate ({analytics.maintenance_costs.upcoming_count} scheduled)</p>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-3">Maintenance complete karte waqt actual cost log hota hai — budget tracking ke liye.</p>
          </div>
        </div>
      )}

      {/* Maintenance Alerts */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5" data-testid="maintenance-alerts-panel">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-400" />Maintenance Alerts / रखरखाव अलर्ट ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />All clear — koi maintenance alert nahi 🎉</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2 ${SEV[a.severity].chip.replace('text-', 'x-').includes('red') ? '' : ''} bg-slate-900/40 border-slate-700`} data-testid={`alert-row-${i}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${SEV[a.severity].chip}`}>{SEV[a.severity].label}</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{a.aircraft} — {a.title}</p>
                    {a.detail && <p className="text-slate-400 text-xs truncate">{a.detail}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {a.maintenance_id ? (
                    <Button size="sm" onClick={() => completeMaint(a)} className="bg-green-500 hover:bg-green-600 h-7 text-xs" data-testid={`complete-maint-${a.maintenance_id}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Mark Complete
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setMaintForm({ ...EMPTY_MAINT, aircraft_id: a.aircraft_id, description: a.title, priority: 'high' }); setMaintOpen(true); }}
                      className="border-slate-600 text-yellow-400 h-7 text-xs" data-testid={`schedule-from-alert-${i}`}>
                      <Wrench className="h-3 w-3 mr-1" />Schedule
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fleet Health */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {fleet.map((a) => (
          <div key={a.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4" data-testid={`fleet-health-${a.id}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-medium text-sm truncate">{a.label}</p>
              <span className={`px-2 py-0.5 rounded text-[10px] ${a.maintenance_status === 'operational' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{a.maintenance_status?.toUpperCase()}</span>
            </div>
            <p className="text-slate-400 text-xs mb-2">{a.total_flight_hours}h total • {a.current_total_km} km • {a.hours_since_maintenance}h since maintenance</p>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full ${a.health_pct > 50 ? 'bg-green-500' : a.health_pct > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${a.health_pct}%` }} />
            </div>
            <p className="text-slate-500 text-[11px] mt-1">Maintenance health: {a.health_pct}% {a.next_maintenance ? `• Next: ${a.next_maintenance.type} on ${(a.next_maintenance.date || '').slice(0, 10)}` : ''}</p>
          </div>
        ))}
      </div>

      {/* Digital Logbook */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden" data-testid="flight-logbook-panel">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
          <h2 className="text-white font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-sky-400" />Digital Flight Logbook / डिजिटल लॉगबुक</h2>
          <div className="flex items-center gap-3">
            {logbook?.totals && (
              <span className="text-slate-400 text-xs">{logbook.totals.flights} flights • {logbook.totals.hours}h • {logbook.totals.distance_km} km • <Fuel className="h-3 w-3 inline" /> {logbook.totals.fuel_liters}L</span>
            )}
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white h-8" data-testid="export-logbook-btn"
              onClick={async () => {
                try {
                  const res = await api.get('/erp/operator/logbook/export', { params: aircraftFilter ? { aircraft_id: aircraftFilter } : {}, responseType: 'blob' });
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'AirYatra_Flight_Logbook.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Logbook CSV exported — DGCA audit ready');
                } catch (e) { toast.error('Export failed'); }
              }}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
            <select value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)} className="bg-slate-800 text-white rounded-lg px-3 py-1.5 border border-slate-700 text-sm" data-testid="logbook-aircraft-filter">
              <option value="">All Aircraft</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>
        {!logbook?.records?.length ? (
          <div className="p-8 text-center text-slate-400">No flight log entries yet — "Add Flight Log" se pehli entry karein</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="text-left p-3 text-slate-400">Date/Time</th>
                  <th className="text-left p-3 text-slate-400">Aircraft</th>
                  <th className="text-left p-3 text-slate-400">Route</th>
                  <th className="text-left p-3 text-slate-400">Pilot</th>
                  <th className="text-right p-3 text-slate-400">Duration</th>
                  <th className="text-right p-3 text-slate-400">Distance</th>
                  <th className="text-right p-3 text-slate-400">Fuel</th>
                </tr>
              </thead>
              <tbody>
                {logbook.records.map((r) => (
                  <tr key={r.id} className="border-t border-slate-700/60" data-testid={`log-row-${r.id}`}>
                    <td className="p-3 text-slate-300">{(r.departure_time || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-3 text-white">{r.aircraft_label}</td>
                    <td className="p-3 text-slate-300">{r.departure_location} → {r.arrival_location}</td>
                    <td className="p-3 text-slate-300">{r.pilot_name || '—'}</td>
                    <td className="p-3 text-right text-slate-300">{r.flight_duration_minutes ? `${(r.flight_duration_minutes / 60).toFixed(1)}h` : '—'}</td>
                    <td className="p-3 text-right text-slate-300">{r.distance_km} km</td>
                    <td className="p-3 text-right text-slate-300">{r.fuel_used_liters || 0} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Flight Log Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Flight Log Entry / लॉग एंट्री</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-slate-300">Aircraft *</Label>
              <select value={logForm.aircraft_id} onChange={(e) => setLogForm({ ...logForm, aircraft_id: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="log-aircraft-select">
                <option value="">Select aircraft</option>
                {fleet.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-slate-300">Pilot *</Label>
              <select value={logForm.pilot_id} onChange={(e) => setLogForm({ ...logForm, pilot_id: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="log-pilot-select">
                <option value="">Select pilot</option>
                {pilots.map((p) => <option key={p.id} value={p.id}>{p.name || p.full_name}</option>)}
              </select>
            </div>
            <div><Label className="text-slate-300">From *</Label><Input value={logForm.departure_location} onChange={(e) => setLogForm({ ...logForm, departure_location: e.target.value })} placeholder="Mumbai" className="bg-slate-800 border-slate-700 mt-1" data-testid="log-from-input" /></div>
            <div><Label className="text-slate-300">To *</Label><Input value={logForm.arrival_location} onChange={(e) => setLogForm({ ...logForm, arrival_location: e.target.value })} placeholder="Shirdi" className="bg-slate-800 border-slate-700 mt-1" data-testid="log-to-input" /></div>
            <div className="col-span-2"><Label className="text-slate-300">Departure Time *</Label><Input type="datetime-local" value={logForm.departure_time} onChange={(e) => setLogForm({ ...logForm, departure_time: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="log-time-input" /></div>
            <div><Label className="text-slate-300">Duration (min)</Label><Input type="number" value={logForm.flight_duration_minutes} onChange={(e) => setLogForm({ ...logForm, flight_duration_minutes: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="log-duration-input" /></div>
            <div><Label className="text-slate-300">Distance (km) *</Label><Input type="number" value={logForm.distance_km} onChange={(e) => setLogForm({ ...logForm, distance_km: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="log-distance-input" /></div>
            <div><Label className="text-slate-300">Fuel (L)</Label><Input type="number" value={logForm.fuel_used_liters} onChange={(e) => setLogForm({ ...logForm, fuel_used_liters: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" /></div>
            <div><Label className="text-slate-300">Remarks</Label><Input value={logForm.remarks} onChange={(e) => setLogForm({ ...logForm, remarks: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" /></div>
          </div>
          <Button onClick={addLog} disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 mt-2" data-testid="save-flight-log-btn">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Log Entry
          </Button>
        </DialogContent>
      </Dialog>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>Schedule Maintenance / रखरखाव निर्धारित करें</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300">Aircraft *</Label>
              <select value={maintForm.aircraft_id} onChange={(e) => setMaintForm({ ...maintForm, aircraft_id: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="maint-aircraft-select">
                <option value="">Select aircraft</option>
                {fleet.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Type</Label>
                <select value={maintForm.type} onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="maint-type-select">
                  {['routine', 'inspection', 'repair', 'overhaul', 'engine', 'avionics'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Priority</Label>
                <select value={maintForm.priority} onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="maint-priority-select">
                  {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-slate-300">Scheduled Date *</Label><Input type="date" value={maintForm.scheduled_date} onChange={(e) => setMaintForm({ ...maintForm, scheduled_date: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="maint-date-input" /></div>
            <div><Label className="text-slate-300">Description *</Label><Input value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="100-hour inspection" className="bg-slate-800 border-slate-700 mt-1" data-testid="maint-desc-input" /></div>
            <div><Label className="text-slate-300">Estimated Cost (₹)</Label><Input type="number" value={maintForm.estimated_cost} onChange={(e) => setMaintForm({ ...maintForm, estimated_cost: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" /></div>
            <Button onClick={scheduleMaint} disabled={saving} className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900" data-testid="save-maintenance-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OperatorERP;
