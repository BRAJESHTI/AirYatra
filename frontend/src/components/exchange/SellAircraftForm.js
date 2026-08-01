import React, { useState } from 'react';
import { Loader2, Upload, CheckCircle2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

const EMPTY = {
  title: '', manufacturer: '', model: '', category: 'helicopter',
  year: '', price_cr: '', flight_hours: '', seats: '', location: '',
  description: '', features: '',
};

export const SellAircraftForm = ({ open, onClose, user }) => {
  const [form, setForm] = useState(EMPTY);
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/exchange/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImageUrl(res.data.image_url);
      toast.success('Photo uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const required = ['title', 'manufacturer', 'model', 'year', 'price_cr', 'flight_hours', 'seats', 'location'];
    const missing = required.filter(k => !String(form[k]).trim());
    if (missing.length) { toast.error('Please fill all required fields / सभी फ़ील्ड भरें'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title, manufacturer: form.manufacturer, model: form.model,
        category: form.category, year: parseInt(form.year, 10),
        price_inr: parseFloat(form.price_cr) * 10000000,
        flight_hours: parseInt(form.flight_hours, 10), seats: parseInt(form.seats, 10),
        location: form.location, description: form.description,
        features: form.features.split(',').map(f => f.trim()).filter(Boolean),
        image: imageUrl,
      };
      await api.post('/exchange/listings', payload);
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit listing');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => { setForm(EMPTY); setImageUrl(null); setDone(false); onClose(); };

  const inputCls = 'bg-slate-800 border-slate-600 text-white';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="sell-aircraft-dialog">
        {done ? (
          <div className="text-center py-10" data-testid="sell-success-message">
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold">Listing Submitted! / लिस्टिंग जमा हो गई</h3>
            <p className="text-slate-400 mt-2 max-w-md mx-auto">
              Our team will verify your aircraft details and publish it within 48 hours. You'll receive an email once it's live.
            </p>
            <Button onClick={close} className="mt-6 bg-orange-500 hover:bg-orange-600" data-testid="sell-done-btn">Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Sell Your Aircraft / अपना विमान बेचें</DialogTitle>
              <DialogDescription className="text-slate-400">
                Submit details below — our team verifies every listing before it goes live.
              </DialogDescription>
            </DialogHeader>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">Listing Title *</label>
                <Input value={form.title} onChange={set('title')} placeholder="e.g. Bell 407GXi — Low Hours" className={inputCls} data-testid="sell-title-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Manufacturer *</label>
                <Input value={form.manufacturer} onChange={set('manufacturer')} placeholder="Bell / Airbus / Cessna" className={inputCls} data-testid="sell-manufacturer-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Model *</label>
                <Input value={form.model} onChange={set('model')} placeholder="407GXi" className={inputCls} data-testid="sell-model-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Category *</label>
                <select value={form.category} onChange={set('category')} className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md px-3 text-sm text-white" data-testid="sell-category-select">
                  <option value="helicopter">Helicopter</option>
                  <option value="jet">Private Jet</option>
                  <option value="turboprop">Turboprop</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Year of Manufacture *</label>
                <Input type="number" value={form.year} onChange={set('year')} placeholder="2019" className={inputCls} data-testid="sell-year-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400 flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Asking Price (₹ Crores) *</label>
                <Input type="number" value={form.price_cr} onChange={set('price_cr')} placeholder="28.5" className={inputCls} data-testid="sell-price-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Total Flight Hours *</label>
                <Input type="number" value={form.flight_hours} onChange={set('flight_hours')} placeholder="1250" className={inputCls} data-testid="sell-hours-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Seats *</label>
                <Input type="number" value={form.seats} onChange={set('seats')} placeholder="7" className={inputCls} data-testid="sell-seats-input" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Location *</label>
                <Input value={form.location} onChange={set('location')} placeholder="Mumbai, Maharashtra" className={inputCls} data-testid="sell-location-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">Description</label>
                <textarea value={form.description} onChange={set('description')} placeholder="Maintenance history, avionics, ownership details..." className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-white min-h-[80px]" data-testid="sell-description-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">Key Features (comma separated)</label>
                <Input value={form.features} onChange={set('features')} placeholder="Garmin G1000, Air Conditioning, Leather Interior" className={inputCls} data-testid="sell-features-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">Aircraft Photo (max 8MB)</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-orange-500/60 text-sm text-slate-300" data-testid="sell-photo-upload">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? 'Uploading...' : imageUrl ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
                  </label>
                  {imageUrl && <img src={imageUrl} alt="preview" className="h-14 w-20 object-cover rounded-lg border border-slate-700" data-testid="sell-photo-preview" />}
                </div>
              </div>
            </div>

            <Button onClick={submit} disabled={submitting || uploading} className="w-full bg-orange-500 hover:bg-orange-600 mt-2" data-testid="sell-submit-btn">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit for Review / समीक्षा के लिए भेजें
            </Button>
            <p className="text-slate-500 text-xs text-center">Listed as: {user?.full_name} • Verified within 48 hours</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SellAircraftForm;
