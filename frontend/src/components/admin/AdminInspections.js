import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2, Mail, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '../../services/api';

const STATUS_STYLES = {
  requested: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const SLOT_LABELS = { morning: 'Morning (9–12)', afternoon: 'Afternoon (12–4)', evening: 'Evening (4–7)' };

export const AdminInspections = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    api.get('/exchange/admin/inspections')
      .then(res => setInspections(res.data.inspections || []))
      .catch(() => toast.error('Failed to load inspections'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    setActing(id + status);
    try {
      const res = await api.patch(`/exchange/admin/inspections/${id}/status?status=${status}`);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-3" data-testid="admin-inspections-list">
      {inspections.length === 0 && <p className="text-slate-500 text-center py-10">No inspection requests yet.</p>}
      {inspections.map(i => (
        <div key={i.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`admin-inspection-${i.id}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-orange-400" /> {i.listing_title}
                </h3>
                <Badge className={`border ${STATUS_STYLES[i.status] || ''}`} data-testid={`inspection-status-${i.id}`}>{i.status}</Badge>
              </div>
              <p className="text-orange-400 text-sm mt-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {i.preferred_date} • {SLOT_LABELS[i.time_slot] || i.time_slot} • {i.location}
              </p>
              {i.notes && <p className="text-slate-300 text-sm mt-2 bg-slate-800/60 rounded-lg p-2.5">"{i.notes}"</p>}
              <p className="text-slate-400 text-xs mt-2 flex items-center gap-3 flex-wrap">
                <span>{i.buyer_name}</span>
                {i.buyer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {i.buyer_email}</span>}
                {i.buyer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {i.buyer_phone}</span>}
                <span>Requested {new Date(i.created_at).toLocaleString('en-IN')}</span>
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {i.status === 'requested' && (
                <>
                  <Button size="sm" onClick={() => setStatus(i.id, 'confirmed')} disabled={!!acting} className="bg-green-600 hover:bg-green-700" data-testid={`confirm-inspection-${i.id}`}>
                    {acting === i.id + 'confirmed' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Email'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(i.id, 'cancelled')} disabled={!!acting} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid={`cancel-inspection-${i.id}`}>
                    Cancel
                  </Button>
                </>
              )}
              {i.status === 'confirmed' && (
                <>
                  <Button size="sm" onClick={() => setStatus(i.id, 'completed')} disabled={!!acting} className="bg-blue-600 hover:bg-blue-700" data-testid={`complete-inspection-${i.id}`}>
                    Mark Completed
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(i.id, 'cancelled')} disabled={!!acting} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid={`cancel-confirmed-inspection-${i.id}`}>
                    Cancel & Email
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminInspections;
