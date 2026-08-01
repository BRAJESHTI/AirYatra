import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLES = {
  present: 'bg-green-500/20 text-green-400',
  half_day: 'bg-yellow-500/20 text-yellow-400',
  on_leave: 'bg-blue-500/20 text-blue-400',
  absent: 'bg-red-500/20 text-red-400',
};

export const EmpAttendance = ({ onChanged }) => {
  const [data, setData] = useState(null);
  const [acting, setActing] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    api.get('/hr/holidays').then((res) => setHolidays(res.data.holidays || [])).catch(() => {});
  }, []);

  const load = async () => {
    try {
      const res = await api.get('/hr/attendance/my', { params: { month, year } });
      setData(res.data);
    } catch (e) { toast.error('Failed to load attendance'); }
  };

  useEffect(() => { load(); }, [month, year]);

  const getLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve({}),
        { timeout: 4000 }
      );
    });

  const mark = async (type) => {
    setActing(true);
    try {
      const loc = await getLocation();
      const res = await api.post(`/hr/attendance/${type}`, loc);
      toast.success(res.data.message);
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally { setActing(false); }
  };

  const checkInWithSelfie = async () => {
    if (!selfieFile) return toast.error('Selfie zaroori hai / सेल्फी आवश्यक है');
    setActing(true);
    try {
      const loc = await getLocation();
      const res = await api.post('/hr/attendance/check-in', loc);
      const fd = new FormData();
      fd.append('file', selfieFile);
      await api.post(`/hr/attendance/${res.data.attendance_id}/selfie`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Check-in successful with selfie / सेल्फी के साथ चेक-इन सफल');
      setSelfieOpen(false);
      setSelfieFile(null);
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Check-in failed');
    } finally { setActing(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayRec = data?.attendance?.find((a) => a.date === today);
  const checkedIn = todayRec && !todayRec.check_out_time;
  const done = todayRec && todayRec.check_out_time;
  const todayHoliday = holidays.find((h) => h.date === today);
  const upcoming = holidays.filter((h) => h.date >= today).slice(0, 3);

  return (
    <div className="space-y-6" data-testid="emp-attendance">
      <h1 className="text-2xl font-bold text-white">Attendance / उपस्थिति</h1>

      {todayHoliday && (
        <div className="bg-purple-500/15 border border-purple-500/40 rounded-xl p-4 text-white" data-testid="emp-holiday-banner">
          🎉 Aaj company holiday hai: <b>{todayHoliday.name}</b> — check-in optional hai, yeh paid day hai
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm">Today / आज • {today}</p>
          <p className="text-white text-lg font-semibold">
            {done ? `Done — ${todayRec.total_hours}h worked` : checkedIn ? `Checked in at ${new Date(todayRec.check_in_time).toLocaleTimeString()}` : 'Not checked in yet / अभी चेक-इन नहीं हुआ'}
          </p>
        </div>
        <div className="flex gap-3">
          {!todayRec && (
            <Button onClick={() => setSelfieOpen(true)} disabled={acting} className="bg-green-500 hover:bg-green-600" data-testid="check-in-btn">
              <LogIn className="h-4 w-4 mr-2" /> Check In / चेक-इन
            </Button>
          )}
          {checkedIn && (
            <Button onClick={() => mark('check-out')} disabled={acting} className="bg-orange-500 hover:bg-orange-600" data-testid="check-out-btn">
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />} Check Out / चेक-आउट
            </Button>
          )}
          {done && <span className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm">✓ Completed for today</span>}
        </div>
      </div>

      <Dialog open={selfieOpen} onOpenChange={(v) => { setSelfieOpen(v); if (!v) setSelfieFile(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-green-400" />Check-in Selfie / चेक-इन सेल्फी</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Verification ke liye ek quick selfie lein / सत्यापन के लिए सेल्फी लें</p>
            <div>
              <Label className="text-slate-300">Selfie (camera) *</Label>
              <Input type="file" accept="image/*" capture="user" onChange={(e) => setSelfieFile(e.target.files[0])} className="bg-slate-800 border-slate-700 mt-1 file:text-slate-300" data-testid="selfie-input" />
            </div>
            {selfieFile && (
              <img src={URL.createObjectURL(selfieFile)} alt="Selfie preview" className="h-32 w-32 object-cover rounded-lg border border-slate-700 mx-auto" data-testid="selfie-preview" />
            )}
            <Button onClick={checkInWithSelfie} disabled={acting || !selfieFile} className="w-full bg-green-500 hover:bg-green-600" data-testid="confirm-check-in-btn">
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}Confirm Check In / चेक-इन करें
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm" data-testid="attendance-month-select">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleString('en', { month: 'long' })}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm">
          {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {data?.summary && (
          <span className="text-slate-400 text-sm ml-auto">
            {data.summary.present_days} present • {data.summary.half_days} half • {data.summary.total_hours}h total
          </span>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700" data-testid="upcoming-holidays-card">
          <p className="text-purple-400 font-semibold text-sm mb-2">Upcoming Holidays / आने वाली छुट्टियां</p>
          <div className="flex flex-wrap gap-3">
            {upcoming.map((h) => (
              <span key={h.id} className="bg-purple-500/15 border border-purple-500/30 rounded-lg px-3 py-1.5 text-sm text-white">
                {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {!data?.attendance?.length ? (
          <div className="p-8 text-center text-slate-400"><Clock className="h-10 w-10 mx-auto mb-2 text-slate-600" />No attendance records this month</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 text-slate-400">Date</th>
                <th className="text-left p-3 text-slate-400">Check In</th>
                <th className="text-left p-3 text-slate-400">Check Out</th>
                <th className="text-right p-3 text-slate-400">Hours</th>
                <th className="text-center p-3 text-slate-400">Selfie</th>
                <th className="text-center p-3 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.attendance.map((a) => (
                <tr key={a.date} className="border-t border-slate-700/60">
                  <td className="p-3 text-white">{a.date}</td>
                  <td className="p-3 text-slate-300">{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '—'}</td>
                  <td className="p-3 text-slate-300">{a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : '—'}</td>
                  <td className="p-3 text-right text-slate-300">{a.total_hours || 0}</td>
                  <td className="p-3 text-center">
                    {a.selfie_url ? (
                      <a href={`${BACKEND}${a.selfie_url}`} target="_blank" rel="noreferrer" data-testid={`selfie-link-${a.date}`}>
                        <img src={`${BACKEND}${a.selfie_url}`} alt="selfie" className="h-8 w-8 rounded-full object-cover border border-slate-600 inline-block hover:scale-150 transition-transform" />
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_STYLES[a.status] || 'bg-slate-500/20 text-slate-400'}`}>{a.status?.replace('_', ' ').toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmpAttendance;
