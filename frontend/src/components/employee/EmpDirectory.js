import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, Camera, Loader2, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '../../services/api';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const AVATAR_COLORS = ['bg-sky-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500'];
const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const EmpDirectory = ({ user }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/directory');
      setStaff(res.data.staff);
    } catch (e) { toast.error('Failed to load directory'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/hr/employee/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Photo updated / फोटो अपडेट हो गई');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to upload photo');
    } finally { setUploading(false); }
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? staff.filter((s) =>
        [s.full_name, s.department, s.designation, s.email, s.employee_code]
          .filter(Boolean).some((v) => v.toLowerCase().includes(term)))
    : staff;

  return (
    <div className="space-y-6" data-testid="emp-directory">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Directory / टीम डायरेक्टरी</h1>
          <p className="text-slate-400 text-sm">{staff.length} colleagues</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files[0])} data-testid="my-photo-input" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="border-slate-600 text-slate-300" data-testid="update-my-photo-btn">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}Update My Photo
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, department, designation... / नाम, विभाग खोजें"
          className="bg-slate-800 border-slate-700 pl-9 text-white" data-testid="directory-search-input" />
      </div>

      {loading ? (
        <div className="text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-10 text-center border border-slate-700">
          <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-white">No colleagues match "{q}"</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <div key={s.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-sky-500/50 transition-colors" data-testid={`directory-card-${s.id}`}>
              <div className="flex items-center gap-3">
                {s.photo_url ? (
                  <img src={`${BACKEND}${s.photo_url}`} alt={s.full_name} className="h-14 w-14 rounded-full object-cover border-2 border-slate-600" />
                ) : (
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials(s.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.full_name}{s.id === user?.id ? ' (You)' : ''}</p>
                  <p className="text-sky-400 text-xs">{s.designation || (s.roles || []).join(', ')}</p>
                  {s.department && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 text-[11px]">{s.department}</span>}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1">
                <p className="text-slate-400 text-xs flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" />{s.email}</p>
                {s.phone && <p className="text-slate-400 text-xs flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{s.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmpDirectory;
