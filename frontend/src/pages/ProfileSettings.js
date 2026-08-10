import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Shield, Trash2, Loader2, Save, Mail, Phone, MapPin,
  KeyRound, AlertTriangle, BadgeCheck, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import api from '../services/api';
import { toast } from 'sonner';

export default function ProfileSettings({ user, setUser }) {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '', city: '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setMe(res.data);
        setForm({
          full_name: res.data.full_name || '',
          phone: res.data.phone || '',
          address: res.data.address || '',
          city: res.data.city || '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const isGoogleUser = me?.auth_provider === 'google_emergent';

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      setMe(res.data.user);
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...res.data.user }));
      setUser?.({ ...user, ...res.data.user });
      toast.success('Profile updated successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.new_password !== pw.confirm) return toast.error('New passwords do not match');
    if (pw.new_password.length < 8) return toast.error('New password must be at least 8 characters');
    setChangingPw(true);
    try {
      await api.put('/auth/change-password', {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      toast.success('Password changed — other devices logged out');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.post('/auth/delete-account', {
        password: isGoogleUser ? null : deletePassword,
        confirm_text: deleteConfirmText,
      });
      toast.success('Account deleted. Goodbye!');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser?.(null);
      setTimeout(() => navigate('/'), 800);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete account');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-16 px-4" data-testid="profile-settings-page">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {me?.profile_picture ? (
            <img src={me.profile_picture} alt="avatar" className="h-16 w-16 rounded-full border-2 border-orange-500/50 object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-2xl font-bold text-orange-400">
              {(me?.full_name || me?.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {(me?.roles || []).map(r => (
                <span key={r} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase">{r}</span>
              ))}
              {isGoogleUser && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3" /> Google Account
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" data-testid="profile-info-card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-orange-400" /> Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email (cannot be changed)</label>
              <Input value={me?.email || ''} disabled className="bg-slate-800/50 border-slate-700 text-slate-400 mt-1" data-testid="profile-email-input" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Full Name</label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="profile-name-input" />
              </div>
              <div>
                <label className="text-sm text-slate-400 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="profile-phone-input" />
              </div>
              <div>
                <label className="text-sm text-slate-400 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Address</label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="profile-address-input" />
              </div>
              <div>
                <label className="text-sm text-slate-400">City</label>
                <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="profile-city-input" />
              </div>
            </div>
            <Button onClick={saveProfile} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-profile-btn">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Security */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" data-testid="security-card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-400" /> Security — Change Password
          </h2>
          {isGoogleUser ? (
            <p className="text-slate-400 text-sm" data-testid="google-user-pw-note">
              You sign in with Google — no password is set on this account. To add a password, use
              <button onClick={() => navigate('/forgot-password')} className="text-orange-400 hover:underline ml-1">Forgot Password</button>.
            </p>
          ) : (
            <div className="space-y-3">
              <Input type="password" placeholder="Current password" value={pw.current_password}
                onChange={e => setPw({ ...pw, current_password: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white" data-testid="current-password-input" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="password" placeholder="New password (min 8 chars)" value={pw.new_password}
                  onChange={e => setPw({ ...pw, new_password: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white" data-testid="new-password-input" />
                <Input type="password" placeholder="Confirm new password" value={pw.confirm}
                  onChange={e => setPw({ ...pw, confirm: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white" data-testid="confirm-password-input" />
              </div>
              <Button onClick={changePassword} disabled={changingPw || !pw.current_password || !pw.new_password}
                variant="outline" className="border-slate-600 text-slate-200" data-testid="change-password-btn">
                {changingPw ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}
                Change Password
              </Button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-6" data-testid="danger-zone-card">
          <h2 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Deleting your account will deactivate it permanently and log you out of all devices.
            Your booking history is retained for legal/accounting records.
          </p>
          <Button onClick={() => setDeleteOpen(true)} variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="delete-account-btn">
            <Trash2 className="h-4 w-4 mr-1" /> Delete My Account
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="bg-slate-900 border-red-500/40 text-white max-w-md" data-testid="delete-account-dialog">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Delete Account — Are you sure?
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                This action cannot be undone from the app. You will be logged out everywhere immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!isGoogleUser && (
                <div>
                  <label className="text-sm text-slate-400">Enter your password to confirm</label>
                  <Input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="delete-password-input" />
                </div>
              )}
              <div>
                <label className="text-sm text-slate-400">Type <span className="font-mono text-red-400">DELETE</span> to confirm</label>
                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE" className="bg-slate-800 border-slate-600 text-white mt-1 font-mono" data-testid="delete-confirm-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
              <Button onClick={deleteAccount}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE' || (!isGoogleUser && !deletePassword)}
                className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-btn">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogOut className="h-4 w-4 mr-1" />}
                Delete Forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
