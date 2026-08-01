import React, { useState, useEffect, useCallback } from 'react';
import { Plane, MessageSquare, CheckCircle2, XCircle, BadgeCheck, Clock, MapPin, Phone, Mail, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '../../services/api';

const formatCr = (p) => `₹${(p / 10000000).toFixed(p % 10000000 === 0 ? 0 : 1)} Cr`;

const STATUS_STYLES = {
  pending_review: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  sold: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const ExchangeManagement = () => {
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, i] = await Promise.all([
        api.get('/exchange/admin/listings'),
        api.get('/exchange/admin/inquiries'),
      ]);
      setListings(l.data.listings || []);
      setInquiries(i.data.inquiries || []);
    } catch (e) {
      toast.error('Failed to load exchange data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setListingStatus = async (id, status) => {
    setActing(id + status);
    try {
      const res = await api.patch(`/exchange/admin/listings/${id}/status?status=${status}`);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const setInquiryStatus = async (id, status) => {
    setActing(id + status);
    try {
      await api.patch(`/exchange/admin/inquiries/${id}/status?status=${status}`);
      toast.success(`Inquiry marked ${status}`);
      load();
    } catch (e) {
      toast.error('Action failed');
    } finally {
      setActing(null);
    }
  };

  const pendingCount = listings.filter(l => l.status === 'pending_review').length;
  const newInquiries = inquiries.filter(i => i.status === 'new').length;

  return (
    <div className="space-y-6" data-testid="exchange-management">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plane className="h-6 w-6 text-orange-500" /> Aviation Exchange
        </h1>
        <p className="text-slate-400 text-sm">Approve aircraft listings & manage buyer inquiries / लिस्टिंग स्वीकृति और खरीदार पूछताछ</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('listings')}
          className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border transition-all ${tab === 'listings' ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-700 text-slate-300 hover:border-orange-500/50'}`}
          data-testid="exchange-tab-listings"
        >
          <Tag className="h-4 w-4" /> Listings
          {pendingCount > 0 && <Badge className="bg-yellow-500 text-slate-900 ml-1">{pendingCount} pending</Badge>}
        </button>
        <button
          onClick={() => setTab('inquiries')}
          className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border transition-all ${tab === 'inquiries' ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-700 text-slate-300 hover:border-orange-500/50'}`}
          data-testid="exchange-tab-inquiries"
        >
          <MessageSquare className="h-4 w-4" /> Buyer Inquiries
          {newInquiries > 0 && <Badge className="bg-yellow-500 text-slate-900 ml-1">{newInquiries} new</Badge>}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : tab === 'listings' ? (
        <div className="space-y-3" data-testid="exchange-listings-list">
          {listings.length === 0 && <p className="text-slate-500 text-center py-10">No listings yet.</p>}
          {listings.map(l => (
            <div key={l.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4" data-testid={`admin-listing-${l.id}`}>
              <img src={l.image} alt={l.title} className="w-full sm:w-36 h-24 object-cover rounded-lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold">{l.title}</h3>
                  <Badge className={`border ${STATUS_STYLES[l.status] || ''}`} data-testid={`listing-status-${l.id}`}>{l.status.replace('_', ' ')}</Badge>
                  {l.verified && <BadgeCheck className="h-4 w-4 text-green-400" />}
                </div>
                <p className="text-orange-400 font-bold text-sm mt-1">{formatCr(l.price_inr)}</p>
                <p className="text-slate-400 text-xs mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {l.flight_hours?.toLocaleString()} hrs</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.location}</span>
                  <span>Seller: {l.seller_name} ({l.seller_type})</span>
                </p>
                {l.description && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{l.description}</p>}
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                {l.status === 'pending_review' && (
                  <>
                    <Button size="sm" onClick={() => setListingStatus(l.id, 'active')} disabled={!!acting} className="bg-green-600 hover:bg-green-700" data-testid={`approve-listing-${l.id}`}>
                      {acting === l.id + 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setListingStatus(l.id, 'rejected')} disabled={!!acting} className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid={`reject-listing-${l.id}`}>
                      {acting === l.id + 'rejected' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" /> Reject</>}
                    </Button>
                  </>
                )}
                {l.status === 'active' && (
                  <Button size="sm" variant="outline" onClick={() => setListingStatus(l.id, 'sold')} disabled={!!acting} className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10" data-testid={`sold-listing-${l.id}`}>
                    Mark Sold
                  </Button>
                )}
                {l.status === 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => setListingStatus(l.id, 'active')} disabled={!!acting} className="border-green-500/50 text-green-400 hover:bg-green-500/10" data-testid={`reapprove-listing-${l.id}`}>
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3" data-testid="exchange-inquiries-list">
          {inquiries.length === 0 && <p className="text-slate-500 text-center py-10">No buyer inquiries yet.</p>}
          {inquiries.map(i => (
            <div key={i.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`admin-inquiry-${i.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{i.listing_title}</h3>
                    <Badge className={`border ${i.status === 'new' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : i.status === 'contacted' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>{i.status}</Badge>
                  </div>
                  <p className="text-slate-300 text-sm mt-2 bg-slate-800/60 rounded-lg p-3">"{i.message}"</p>
                  <p className="text-slate-400 text-xs mt-2 flex items-center gap-3 flex-wrap">
                    <span>{i.buyer_name}</span>
                    {i.buyer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {i.buyer_email}</span>}
                    {i.buyer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {i.buyer_phone}</span>}
                    <span>{new Date(i.created_at).toLocaleString('en-IN')}</span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {i.status === 'new' && (
                    <Button size="sm" onClick={() => setInquiryStatus(i.id, 'contacted')} disabled={!!acting} className="bg-blue-600 hover:bg-blue-700" data-testid={`contact-inquiry-${i.id}`}>
                      Mark Contacted
                    </Button>
                  )}
                  {i.status !== 'closed' && (
                    <Button size="sm" variant="outline" onClick={() => setInquiryStatus(i.id, 'closed')} disabled={!!acting} className="border-slate-600 text-slate-300" data-testid={`close-inquiry-${i.id}`}>
                      Close
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExchangeManagement;
