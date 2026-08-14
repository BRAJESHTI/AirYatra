import React, { useState, useEffect } from 'react';
import { Ban, MapPin, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function OperatorCancelBookings() {
  const [bookings, setBookings] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reasonId, setReasonId] = useState('');
  const [remark, setRemark] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        api.get('/refunds/operator/cancellable'),
        api.get('/refunds/reasons?audience=operator'),
      ]);
      setBookings(b.data.bookings || []);
      setReasons(r.data.reasons || []);
    } catch (e) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async () => {
    if (!selected || !reasonId) return;
    setProcessing(true);
    try {
      const res = await api.post('/refunds/operator-cancel', {
        booking_id: selected.id,
        reason_id: reasonId,
        remark: remark || null,
      });
      toast.success(res.data.message || 'Cancellation logged. Full refund pending approval.');
      setSelected(null);
      setReasonId('');
      setRemark('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div data-testid="operator-cancel-bookings">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Ban className="h-7 w-7 text-red-400" /> Cancel Booking / बुकिंग रद्द करें
        </h1>
        <p className="text-slate-400 mt-1">
          Operator cancellation requires a valid reason. Customer gets FULL refund after team approval.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="glass p-10 rounded-xl text-center">
          <Ban className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No cancellable bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="glass p-5 rounded-xl flex flex-wrap items-center justify-between gap-4" data-testid={`op-booking-${b.id}`}>
              <div>
                <p className="text-white font-semibold">{b.booking_number || b.inquiry_number || `#${b.id?.slice(0, 8)}`}</p>
                <div className="flex items-center gap-2 mt-1 text-slate-300 text-sm">
                  <MapPin className="h-4 w-4 text-green-400" />
                  <span>{b.from_location || b.pickup_location || 'N/A'}</span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                  <MapPin className="h-4 w-4 text-red-400" />
                  <span>{b.to_location || b.drop_location || 'N/A'}</span>
                </div>
                <p className="text-slate-500 text-xs mt-1">
                  {b.departure_date || b.travel_date || 'Date TBD'} • Status: {b.status} • {fmt(b.amount_paid || b.final_price || b.total_amount)}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setSelected(b); setReasonId(''); setRemark(''); }}
                data-testid={`op-cancel-btn-${b.id}`}
              >
                <Ban className="h-4 w-4 mr-1" /> Cancel Booking
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Cancel Booking {selected?.booking_number || selected?.inquiry_number}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Valid reason select karna zaroori hai. Customer ko full refund team approval ke baad milega.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              Operator cancellation par customer ko <b>100% FULL refund</b> milega (team approval ke baad). Valid reason dena zaroori hai.
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Cancellation Reason * (mandatory)</label>
              <select
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                data-testid="op-cancel-reason-select"
              >
                <option value="">-- Select valid reason --</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Additional remarks (optional)</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                rows={2}
                placeholder="Extra details..."
                data-testid="op-cancel-remark-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-600 text-slate-300">
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={processing || !reasonId} data-testid="op-confirm-cancel-btn">
              {processing ? 'Processing...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
