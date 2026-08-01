import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Eye, MessageSquare, PlusCircle, Loader2, ChevronDown, ChevronUp, Mail, Phone, Star } from 'lucide-react';
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

const STATUS_LABELS = {
  pending_review: 'Pending Review / समीक्षा में',
  active: 'Live / लाइव',
  rejected: 'Rejected / अस्वीकृत',
  sold: 'Sold / बिक गया',
};

export const MyAircraftListings = ({ user }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/exchange/my-listings')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load your listings'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const listings = data?.listings || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="my-aircraft-listings">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plane className="h-6 w-6 text-orange-500" /> My Aircraft Listings / मेरे विमान
          </h1>
          <p className="text-slate-400 text-sm">Track your listings, views and buyer inquiries</p>
        </div>
        <Button onClick={() => navigate('/exchange')} className="bg-orange-500 hover:bg-orange-600" data-testid="list-new-aircraft-btn">
          <PlusCircle className="h-4 w-4 mr-2" /> List New Aircraft
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Listings', listings.length, Plane],
          ['Total Views', data?.total_views || 0, Eye],
          ['Inquiries', data?.total_inquiries || 0, MessageSquare],
        ].map(([label, value, Icon]) => (
          <div key={label} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`seller-stat-${label.toLowerCase().replace(' ', '-')}`}>
            <Icon className="h-5 w-5 text-orange-400 mb-2" />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl" data-testid="no-my-listings">
          <Plane className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">You haven't listed any aircraft yet.</p>
          <p className="text-slate-500 text-sm mt-1">List your helicopter, jet or turboprop on India's first aircraft resale marketplace — free!</p>
          <Button onClick={() => navigate('/exchange')} className="mt-4 bg-orange-500 hover:bg-orange-600" data-testid="empty-list-aircraft-btn">
            <PlusCircle className="h-4 w-4 mr-2" /> Sell Your Aircraft
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => (
            <div key={l.id} className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden" data-testid={`my-listing-${l.id}`}>
              <div className="p-4 flex flex-col sm:flex-row gap-4">
                <img src={l.image} alt={l.title} className="w-full sm:w-32 h-22 sm:h-20 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{l.title}</h3>
                    <Badge className={`border ${STATUS_STYLES[l.status] || ''}`} data-testid={`my-listing-status-${l.id}`}>{STATUS_LABELS[l.status] || l.status}</Badge>
                    {l.featured && <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30"><Star className="h-3 w-3 mr-1" /> Featured</Badge>}
                  </div>
                  <p className="text-orange-400 font-bold text-sm mt-1">{formatCr(l.price_inr)}</p>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-4">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {l.views || 0} views</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {(l.inquiries || []).length} inquiries</span>
                    <span>Listed {new Date(l.created_at).toLocaleDateString('en-IN')}</span>
                  </p>
                </div>
                {(l.inquiries || []).length > 0 && (
                  <button
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className="text-orange-400 text-sm flex items-center gap-1 shrink-0 self-start hover:text-orange-300"
                    data-testid={`toggle-inquiries-${l.id}`}
                  >
                    {expanded === l.id ? <>Hide <ChevronUp className="h-4 w-4" /></> : <>View Inquiries <ChevronDown className="h-4 w-4" /></>}
                  </button>
                )}
              </div>
              {expanded === l.id && (
                <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-3" data-testid={`inquiries-panel-${l.id}`}>
                  {l.inquiries.map(i => (
                    <div key={i.id} className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-slate-200 text-sm">"{i.message}"</p>
                      <p className="text-slate-400 text-xs mt-2 flex items-center gap-3 flex-wrap">
                        <span className="text-white font-medium">{i.buyer_name}</span>
                        {i.buyer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {i.buyer_email}</span>}
                        {i.buyer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {i.buyer_phone}</span>}
                        <span>{new Date(i.created_at).toLocaleDateString('en-IN')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAircraftListings;
