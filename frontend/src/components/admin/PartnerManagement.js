import React, { useState, useEffect, useCallback } from 'react';
import { Handshake, Key, Copy, RefreshCw, Ban, CheckCircle2, Loader2, Plus, BookOpen, Calendar, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/partner/v1`;

const STATUS_STYLES = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  revoked: 'bg-red-500/15 text-red-400 border-red-500/30',
  received: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const TYPE_LABELS = { hotel: '🏨 Hotel', travel_agency: '✈️ Travel Agency', corporate: '🏢 Corporate', other: '🤝 Other' };

const EMPTY = { name: '', company: '', partner_type: 'hotel', contact_email: '' };

const copyText = (text, label) => {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
};

const PartnerManagement = () => {
  const [tab, setTab] = useState('partners');
  const [partners, setPartners] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([api.get('/partners'), api.get('/partners/bookings')]);
      setPartners(p.data.partners || []);
      setBookings(b.data.bookings || []);
    } catch (e) {
      toast.error('Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createPartner = async () => {
    if (!form.name.trim() || !form.company.trim() || !form.contact_email.trim()) {
      toast.error('Fill all fields');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/partners', form);
      setNewKey(res.data.partner);
      setForm(EMPTY);
      setCreateOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create partner');
    } finally {
      setCreating(false);
    }
  };

  const act = async (key, fn, successMsg) => {
    setActing(key);
    try {
      const res = await fn();
      toast.success(res.data.message || successMsg);
      if (res.data.api_key) setNewKey({ company: 'Regenerated Key', api_key: res.data.api_key });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const newBookings = bookings.filter(b => b.status === 'received').length;

  return (
    <div className="space-y-6" data-testid="partner-management">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Handshake className="h-6 w-6 text-orange-500" /> Partner API Platform
          </h1>
          <p className="text-slate-400 text-sm">Hotels & travel agencies plug AirYatra bookings into their systems</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-orange-500 hover:bg-orange-600" data-testid="add-partner-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Partner
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['partners', 'Partners', Key, 0], ['bookings', 'Partner Bookings', Calendar, newBookings], ['docs', 'API Docs', BookOpen, 0]].map(([id, label, Icon, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border transition-all ${tab === id ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-700 text-slate-300 hover:border-orange-500/50'}`}
            data-testid={`partner-tab-${id}`}
          >
            <Icon className="h-4 w-4" /> {label}
            {count > 0 && <Badge className="bg-yellow-500 text-slate-900 ml-1">{count} new</Badge>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : tab === 'partners' ? (
        <div className="space-y-3" data-testid="partners-list">
          {partners.length === 0 && <p className="text-slate-500 text-center py-10">No partners yet. Add your first hotel or travel agency partner!</p>}
          {partners.map(p => (
            <div key={p.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`partner-${p.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{p.company}</h3>
                    <Badge className="bg-slate-800 text-slate-300 border border-slate-700">{TYPE_LABELS[p.partner_type] || p.partner_type}</Badge>
                    <Badge className={`border ${STATUS_STYLES[p.status] || ''}`} data-testid={`partner-status-${p.id}`}>{p.status}</Badge>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span>{p.name}</span>
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.contact_email}</span>
                    <span>{p.request_count} API calls</span>
                    {p.last_used_at && <span>Last used {new Date(p.last_used_at).toLocaleString('en-IN')}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-orange-300">{p.api_key.slice(0, 12)}••••••••{p.api_key.slice(-4)}</code>
                    <button onClick={() => copyText(p.api_key, 'API key')} className="text-slate-400 hover:text-white" data-testid={`copy-key-${p.id}`}>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => act(p.id + 'regen', () => api.post(`/partners/${p.id}/regenerate-key`))} disabled={!!acting} className="border-slate-600 text-slate-300" data-testid={`regenerate-key-${p.id}`}>
                    <RefreshCw className="h-4 w-4 mr-1" /> New Key
                  </Button>
                  {p.status === 'active' ? (
                    <Button size="sm" variant="outline" onClick={() => act(p.id + 'revoke', () => api.patch(`/partners/${p.id}/status?status=revoked`))} disabled={!!acting} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid={`revoke-partner-${p.id}`}>
                      <Ban className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => act(p.id + 'activate', () => api.patch(`/partners/${p.id}/status?status=active`))} disabled={!!acting} className="bg-green-600 hover:bg-green-700" data-testid={`activate-partner-${p.id}`}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Activate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'bookings' ? (
        <div className="space-y-3" data-testid="partner-bookings-list">
          {bookings.length === 0 && <p className="text-slate-500 text-center py-10">No partner bookings yet.</p>}
          {bookings.map(b => (
            <div key={b.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`partner-booking-${b.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{b.from_location} → {b.to_location}</h3>
                    <Badge className={`border ${STATUS_STYLES[b.status] || ''}`} data-testid={`booking-status-${b.id}`}>{b.status}</Badge>
                    <Badge className="bg-slate-800 text-slate-300 border border-slate-700">{b.partner_company}</Badge>
                  </div>
                  <p className="text-orange-400 text-sm mt-1 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {b.departure_date} • {b.passengers} pax
                  </p>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span>{b.customer_name}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.customer_phone}</span>
                    {b.customer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {b.customer_email}</span>}
                    <span>Ref: {b.id}</span>
                  </p>
                  {b.notes && <p className="text-slate-500 text-xs mt-1">"{b.notes}"</p>}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {b.status === 'received' && (
                    <Button size="sm" onClick={() => act(b.id + 'proc', () => api.patch(`/partners/bookings/${b.id}/status?status=processing`))} disabled={!!acting} className="bg-blue-600 hover:bg-blue-700" data-testid={`process-booking-${b.id}`}>
                      Start Processing
                    </Button>
                  )}
                  {(b.status === 'received' || b.status === 'processing') && (
                    <>
                      <Button size="sm" onClick={() => act(b.id + 'conf', () => api.patch(`/partners/bookings/${b.id}/status?status=confirmed`))} disabled={!!acting} className="bg-green-600 hover:bg-green-700" data-testid={`confirm-booking-${b.id}`}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(b.id + 'canc', () => api.patch(`/partners/bookings/${b.id}/status?status=cancelled`))} disabled={!!acting} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid={`cancel-booking-${b.id}`}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4" data-testid="partner-api-docs">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">Base URL & Authentication</h3>
            <p className="text-slate-400 text-xs mb-3">All requests need the <code className="text-orange-300">X-API-Key</code> header with the partner's key.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-orange-300 flex-1 overflow-x-auto">{BASE}</code>
              <button onClick={() => copyText(BASE, 'Base URL')} className="text-slate-400 hover:text-white"><Copy className="h-4 w-4" /></button>
            </div>
          </div>
          {[
            ['GET /ping', 'Validate your API key', `curl -H "X-API-Key: YOUR_KEY" ${BASE}/ping`],
            ['GET /aircraft', 'List available aircraft fleet', `curl -H "X-API-Key: YOUR_KEY" ${BASE}/aircraft`],
            ['POST /bookings', 'Create a charter booking request for your customer', `curl -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json" \\\n  -d '{"customer_name":"Rahul Sharma","customer_phone":"+919812345678","customer_email":"rahul@example.com","from_location":"Mumbai","to_location":"Shirdi","departure_date":"2026-08-20","passengers":4,"notes":"VIP guests from hotel"}' \\\n  ${BASE}/bookings`],
            ['GET /bookings/{id}', 'Check booking status', `curl -H "X-API-Key: YOUR_KEY" ${BASE}/bookings/pb-xxxxxxxxxx`],
          ].map(([endpoint, desc, example]) => (
            <div key={endpoint} className="bg-slate-900/70 border border-slate-800 rounded-xl p-5" data-testid={`doc-${endpoint.split(' ')[1].replace(/\W/g, '')}`}>
              <div className="flex items-center justify-between">
                <code className="text-orange-400 font-bold text-sm">{endpoint}</code>
                <button onClick={() => copyText(example, 'Example')} className="text-slate-400 hover:text-white"><Copy className="h-4 w-4" /></button>
              </div>
              <p className="text-slate-400 text-xs mt-1">{desc}</p>
              <pre className="text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-3 mt-2 text-slate-300 overflow-x-auto whitespace-pre-wrap">{example}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Create Partner Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="create-partner-dialog">
          <DialogHeader>
            <DialogTitle>Add API Partner</DialogTitle>
            <DialogDescription className="text-slate-400">An API key is generated automatically — share it securely with the partner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">Contact Person *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Mehta" className="bg-slate-800 border-slate-600 text-white" data-testid="partner-name-input" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Company *</label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Taj Hotels / MakeMyTrip" className="bg-slate-800 border-slate-600 text-white" data-testid="partner-company-input" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Partner Type</label>
              <select value={form.partner_type} onChange={(e) => setForm({ ...form, partner_type: e.target.value })} className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md px-3 text-sm text-white" data-testid="partner-type-select">
                <option value="hotel">Hotel</option>
                <option value="travel_agency">Travel Agency</option>
                <option value="corporate">Corporate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Contact Email *</label>
              <Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="partnerships@tajhotels.com" className="bg-slate-800 border-slate-600 text-white" data-testid="partner-email-input" />
            </div>
            <Button onClick={createPartner} disabled={creating} className="w-full bg-orange-500 hover:bg-orange-600" data-testid="create-partner-submit-btn">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Create & Generate API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="new-key-dialog">
          {newKey && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-green-400" /> API Key — {newKey.company}</DialogTitle>
                <DialogDescription className="text-slate-400">Copy this key now and share securely. Treat it like a password.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-slate-800 border border-green-500/40 rounded px-3 py-2.5 text-green-300 flex-1 break-all" data-testid="new-api-key">{newKey.api_key}</code>
              </div>
              <Button onClick={() => copyText(newKey.api_key, 'API key')} className="w-full bg-green-600 hover:bg-green-700" data-testid="copy-new-key-btn">
                <Copy className="h-4 w-4 mr-2" /> Copy API Key
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerManagement;
