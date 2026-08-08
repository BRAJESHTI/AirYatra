import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2, Plane, CheckCircle2, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

export default function PreFlightChecklist({ isOpen, onClose, bookingId, trip }) {
  const [checklist, setChecklist] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clRes, stRes] = await Promise.all([
        api.get(`/preflight/checklist/${bookingId}?checklist_type=passenger`),
        api.get(`/preflight/status/${bookingId}`),
      ]);
      setChecklist(clRes.data);
      setStatus(stRes.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (isOpen && bookingId) load();
  }, [isOpen, bookingId, load]);

  const toggleItem = async (item) => {
    setToggling(item.id);
    try {
      await api.post('/preflight/checklist/update', {
        booking_id: bookingId,
        checklist_type: 'passenger',
        item_id: item.id,
        checked: !item.checked,
      });
      const res = await api.get(`/preflight/checklist/${bookingId}?checklist_type=passenger`);
      setChecklist(res.data);
      if (res.data.progress?.required_complete && !item.checked) {
        toast.success('✈️ All required checks done — you are ready to fly!');
        api.get(`/preflight/status/${bookingId}`).then(r => setStatus(r.data)).catch(() => {});
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update');
    } finally {
      setToggling(null);
    }
  };

  const progress = checklist?.progress;
  const aircraftStatus = status?.aircraft_checklist?.status || 'not_started';
  const aircraftReady = aircraftStatus === 'complete';

  const grouped = (checklist?.items || []).reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto" data-testid="preflight-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-orange-400" />
            Pre-flight Checklist
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-7 w-7 text-orange-400 animate-spin" /></div>
        ) : !checklist ? (
          <p className="text-slate-400 py-8 text-center">Checklist unavailable</p>
        ) : (
          <div className="space-y-5">
            {/* Flight summary */}
            <div className="bg-slate-800/60 rounded-xl px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-white font-medium">
                <Plane className="h-4 w-4 text-orange-400" />
                {trip?.pickup_location || status?.booking?.from || '—'} → {trip?.drop_location || status?.booking?.to || '—'}
              </div>
              <p className="text-slate-400 text-xs mt-1">
                {trip?.inquiry_number || trip?.booking_number || bookingId?.slice(0, 8)} • {trip?.departure_date ? new Date(trip.departure_date).toLocaleDateString() : status?.booking?.date || 'Date TBD'}
              </p>
            </div>

            {/* Progress */}
            <div data-testid="preflight-progress">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Passenger readiness</span>
                <span className="text-white font-semibold">{progress.checked}/{progress.total} • {progress.percentage}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progress.required_complete ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              {progress.required_complete && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-green-400 text-sm font-semibold" data-testid="preflight-ready-badge">
                  <ShieldCheck className="h-4 w-4" /> Ready to Fly — all required checks complete
                </div>
              )}
            </div>

            {/* Passenger items grouped by category */}
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{category}</p>
                <div className="space-y-2">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      disabled={toggling === item.id}
                      data-testid={`preflight-item-${item.id}`}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        item.checked
                          ? 'bg-green-500/10 border-green-500/40'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        item.checked ? 'bg-green-500 border-green-500' : 'border-slate-500'
                      }`}>
                        {toggling === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                          : item.checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium flex items-center gap-2 flex-wrap ${item.checked ? 'text-green-300' : 'text-white'}`}>
                          {item.item}
                          {item.required && !item.checked && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">REQUIRED</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Aircraft readiness */}
            <div
              className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                aircraftReady ? 'bg-green-500/10 border-green-500/40' : 'bg-amber-500/10 border-amber-500/40'
              }`}
              data-testid="aircraft-readiness-status"
            >
              {aircraftReady
                ? <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                : <Clock className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-semibold ${aircraftReady ? 'text-green-400' : 'text-amber-400'}`}>
                  Aircraft Readiness: {aircraftReady ? 'READY' : aircraftStatus === 'in_progress' ? 'IN PROGRESS' : 'PENDING'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {aircraftReady
                    ? `All ${status?.aircraft_checklist?.required || 18} DGCA aircraft & crew checks completed by operator`
                    : 'Operator/pilot will complete aircraft, crew, fuel & weather checks before departure'}
                </p>
              </div>
            </div>

            {!progress.required_complete && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Complete all REQUIRED items before departure for smooth boarding
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
