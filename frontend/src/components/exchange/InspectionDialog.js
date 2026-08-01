import React, { useState } from 'react';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

export const InspectionDialog = ({ listing, open, onClose }) => {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('morning');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!date || !phone.trim()) {
      toast.error('Please select a date and enter your phone number');
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/exchange/listings/${listing.id}/book-inspection`, {
        preferred_date: date, time_slot: slot, phone, notes,
      });
      toast.success(res.data.message);
      setDate(''); setPhone(''); setNotes('');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to book inspection');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="inspection-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-orange-400" /> Book Pre-Purchase Inspection
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {listing?.title} • {listing?.location}. Our aviation expert accompanies you — free for serious buyers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Preferred Date *</label>
            <Input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
              data-testid="inspection-date-input"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Time Slot *</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md px-3 text-sm text-white"
              data-testid="inspection-slot-select"
            >
              <option value="morning">Morning (9 AM – 12 PM)</option>
              <option value="afternoon">Afternoon (12 PM – 4 PM)</option>
              <option value="evening">Evening (4 PM – 7 PM)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Phone Number *</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx" className="bg-slate-800 border-slate-600 text-white" data-testid="inspection-phone-input" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bringing my own engineer, specific checks needed..."
              className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-white min-h-[60px]"
              data-testid="inspection-notes-input"
            />
          </div>
          <Button onClick={submit} disabled={sending} className="w-full bg-orange-500 hover:bg-orange-600" data-testid="inspection-submit-btn">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
            Request Inspection Slot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InspectionDialog;
