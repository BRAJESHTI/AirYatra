import React, { useState, useEffect } from 'react';
import { Ban, Plus, Trash2, Loader2, User, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';
import { toast } from 'sonner';

function ReasonList({ audience, title, icon: Icon, color }) {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/refunds/reasons?audience=${audience}`);
      setReasons(res.data.reasons || []);
    } catch (e) {
      toast.error('Failed to load reasons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addReason = async () => {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      await api.post('/refunds/reasons', { audience, label: newLabel.trim() });
      toast.success('Reason added');
      setNewLabel('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add reason');
    } finally {
      setAdding(false);
    }
  };

  const removeReason = async (id) => {
    try {
      await api.delete(`/refunds/reasons/${id}`);
      toast.success('Reason removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove');
    }
  };

  return (
    <div className="glass p-6 rounded-xl" data-testid={`reasons-panel-${audience}`}>
      <h2 className={`text-lg font-semibold flex items-center gap-2 mb-4 ${color}`}>
        <Icon className="h-5 w-5" /> {title}
      </h2>
      <div className="flex gap-2 mb-4">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReason()}
          placeholder="Add a new reason..."
          className="bg-slate-800 border-slate-700 text-white"
          data-testid={`add-reason-input-${audience}`}
        />
        <Button onClick={addReason} disabled={adding || !newLabel.trim()} className="bg-orange-500 hover:bg-orange-600" data-testid={`add-reason-btn-${audience}`}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
      ) : reasons.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">No reasons configured</p>
      ) : (
        <div className="space-y-2">
          {reasons.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5" data-testid={`reason-item-${r.id}`}>
              <span className="text-slate-200 text-sm">{r.label}</span>
              <button
                onClick={() => removeReason(r.id)}
                className="text-slate-500 hover:text-red-400 transition-colors"
                data-testid={`delete-reason-${r.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CancellationReasonsManager() {
  return (
    <div data-testid="cancellation-reasons-manager">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Ban className="h-7 w-7 text-red-400" /> Cancellation Reasons</h1>
        <p className="text-slate-400 mt-1">
          Manage the reasons shown in Customer and Operator cancellation dropdowns (Admin/CEO only).
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReasonList audience="customer" title="Customer Reasons" icon={User} color="text-blue-400" />
        <ReasonList audience="operator" title="Operator Reasons" icon={Plane} color="text-orange-400" />
      </div>
    </div>
  );
}
