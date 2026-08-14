import React, { useState, useEffect } from 'react';
import { CalendarDays, Users, TrendingUp, Plus, Trash2, Loader2, Save, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/services/api';
import { toast } from 'sonner';

const toISO = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export default function AssetManagePanel({ asset, open, onClose, onSaved }) {
  const [tab, setTab] = useState('calendar');
  const [blocked, setBlocked] = useState([]);
  const [bookedRanges, setBookedRanges] = useState([]);
  const [crew, setCrew] = useState([]);
  const [rules, setRules] = useState([]);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);

  const resizeImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const uploadPhotos = async (files) => {
    if (!files?.length) return;
    if (images.length + files.length > 6) { toast.error('Maximum 6 photos per asset'); return; }
    setBusy(true);
    try {
      const dataUrls = await Promise.all([...files].map(resizeImage));
      await api.post(`/verticals/assets/${asset.id}/photos`, { images: dataUrls });
      setImages(prev => [...prev, ...dataUrls]);
      toast.success(`${dataUrls.length} photo(s) uploaded`);
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); } finally { setBusy(false); }
  };

  const removePhoto = async (i) => {
    try {
      await api.delete(`/verticals/assets/${asset.id}/photos/${i}`);
      setImages(prev => prev.filter((_, j) => j !== i));
      toast.success('Photo deleted');
      onSaved();
    } catch (e) { toast.error('Delete failed'); }
  };

  useEffect(() => {
    if (!asset || !open) return;
    setBlocked(asset.blocked_dates || []);
    setCrew(asset.crew || []);
    setImages(asset.images || []);
    setRules(asset.seasonal_rules || []);
    setTab('calendar');
    api.get(`/verticals/assets/${asset.id}/availability`)
      .then(r => setBookedRanges(r.data.booked_ranges || []))
      .catch(() => {});
  }, [asset, open]);

  if (!asset) return null;
  const bookedDates = bookedRanges.map(r => new Date(r.start_date));

  const saveCalendar = async () => {
    setBusy(true);
    try {
      await api.put(`/verticals/assets/${asset.id}`, { blocked_dates: blocked });
      toast.success('Availability calendar saved');
      onSaved();
    } catch (e) { toast.error('Failed to save'); } finally { setBusy(false); }
  };

  const saveCrew = async () => {
    if (crew.some(c => !c.name || !c.role)) { toast.error('Each crew member needs name and role'); return; }
    setBusy(true);
    try {
      await api.put(`/verticals/assets/${asset.id}/crew`, { crew });
      toast.success('Crew saved');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };

  const saveRules = async () => {
    if (rules.some(r => !r.name || !r.start_date || !r.end_date || r.multiplier_pct === '')) {
      toast.error('Fill all rule fields'); return;
    }
    setBusy(true);
    try {
      await api.put(`/verticals/assets/${asset.id}/seasonal-rules`,
        { rules: rules.map(r => ({ ...r, multiplier_pct: parseFloat(r.multiplier_pct) })) });
      toast.success('Seasonal pricing saved');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage — {asset.name} ({asset.asset_code})</DialogTitle>
          <DialogDescription className="text-slate-400">Availability calendar, crew and seasonal pricing.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          {[['calendar', 'Calendar', CalendarDays], ['crew', 'Crew', Users], ['pricing', 'Seasonal Pricing', TrendingUp], ['photos', 'Photos', ImagePlus]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
              data-testid={`manage-tab-${id}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'calendar' && (
          <div data-testid="availability-calendar">
            <p className="text-slate-400 text-sm mb-2">Click dates to block/unblock. <span className="text-red-400">Red = blocked</span>, <span className="text-green-400">Green = booked</span>.</p>
            <div className="flex justify-center bg-slate-800/50 rounded-xl p-2">
              <Calendar
                mode="multiple"
                selected={blocked.map(d => new Date(d + 'T12:00:00'))}
                onSelect={(dates) => setBlocked((dates || []).map(toISO))}
                modifiers={{ booked: bookedDates }}
                modifiersClassNames={{ booked: 'bg-green-500/40 text-white rounded-md' }}
                classNames={{ day_selected: 'bg-red-500 text-white hover:bg-red-600' }}
                className="text-white"
              />
            </div>
            <div className="flex justify-between items-center mt-3">
              <p className="text-slate-500 text-xs">{blocked.length} blocked date(s)</p>
              <Button onClick={saveCalendar} disabled={busy} className="bg-orange-500 hover:bg-orange-600" data-testid="save-calendar-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Calendar
              </Button>
            </div>
          </div>
        )}

        {tab === 'crew' && (
          <div data-testid="crew-panel" className="space-y-2">
            {crew.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                {[['name', 'Name *'], ['role', 'Role *'], ['license_no', 'License No'], ['phone', 'Phone']].map(([k, ph]) => (
                  <Input key={k} value={c[k] || ''} placeholder={ph}
                    onChange={(e) => setCrew(cs => cs.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))}
                    className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`crew-${k}-${i}`} />
                ))}
                <button onClick={() => setCrew(cs => cs.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400" data-testid={`crew-remove-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {crew.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No crew members added</p>}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setCrew(cs => [...cs, { name: '', role: '', license_no: '', phone: '' }])}
                className="border-slate-600 text-slate-300" data-testid="add-crew-btn">
                <Plus className="h-4 w-4 mr-1" /> Add Crew Member
              </Button>
              <Button onClick={saveCrew} disabled={busy} className="bg-orange-500 hover:bg-orange-600" data-testid="save-crew-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Crew
              </Button>
            </div>
          </div>
        )}

        {tab === 'pricing' && (
          <div data-testid="seasonal-panel" className="space-y-2">
            <p className="text-slate-400 text-sm">Season ke dates par price multiplier apply hota hai (e.g. +25% peak season, -10% off-season).</p>
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_0.7fr_auto] gap-2 items-center">
                <Input value={r.name || ''} placeholder="Season name *"
                  onChange={(e) => setRules(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`rule-name-${i}`} />
                <Input type="date" value={r.start_date || ''}
                  onChange={(e) => setRules(rs => rs.map((x, j) => j === i ? { ...x, start_date: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`rule-start-${i}`} />
                <Input type="date" value={r.end_date || ''}
                  onChange={(e) => setRules(rs => rs.map((x, j) => j === i ? { ...x, end_date: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`rule-end-${i}`} />
                <Input type="number" value={r.multiplier_pct ?? ''} placeholder="+%"
                  onChange={(e) => setRules(rs => rs.map((x, j) => j === i ? { ...x, multiplier_pct: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`rule-pct-${i}`} />
                <button onClick={() => setRules(rs => rs.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400" data-testid={`rule-remove-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {rules.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No seasonal rules yet</p>}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setRules(rs => [...rs, { name: '', start_date: '', end_date: '', multiplier_pct: '' }])}
                className="border-slate-600 text-slate-300" data-testid="add-rule-btn">
                <Plus className="h-4 w-4 mr-1" /> Add Season Rule
              </Button>
              <Button onClick={saveRules} disabled={busy} className="bg-orange-500 hover:bg-orange-600" data-testid="save-rules-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Pricing
              </Button>
            </div>
          </div>
        )}
        {tab === 'photos' && (
          <div data-testid="photos-panel">
            <p className="text-slate-400 text-sm mb-3">Upload up to 6 photos — customers will see these before booking. ({images.length}/6)</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-700" data-testid={`photo-item-${i}`}>
                  <img src={img} alt={`Photo ${i + 1}`} className="w-full h-28 object-cover" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`delete-photo-${i}`}>
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="h-28 rounded-lg border-2 border-dashed border-slate-600 hover:border-orange-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-orange-400 transition-colors" data-testid="upload-photo-label">
                  {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><ImagePlus className="h-6 w-6 mb-1" /><span className="text-xs">Add Photos</span></>}
                  <input type="file" accept="image/*" multiple className="hidden" disabled={busy}
                    onChange={(e) => { uploadPhotos(e.target.files); e.target.value = ''; }} data-testid="photo-file-input" />
                </label>
              )}
            </div>
            {images.length === 0 && <p className="text-slate-500 text-sm text-center">No photos yet — first photo becomes the cover image</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

