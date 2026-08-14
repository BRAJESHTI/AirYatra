import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Plane, MapPin, Clock, Users, BadgeCheck, ArrowLeft, Send, Loader2, Share2, Copy, ClipboardCheck, Eye, MessageCircle, Twitter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '../services/api';
import InspectionDialog from '../components/exchange/InspectionDialog';

const formatCr = (price) => `₹${(price / 10000000).toFixed(price % 10000000 === 0 ? 0 : 1)} Cr`;

const STATUS_BADGES = {
  active: null,
  sold: { label: 'SOLD', cls: 'bg-blue-500 text-white' },
  in_auction: { label: 'IN AUCTION 🔨', cls: 'bg-orange-500 text-white' },
};

export default function ListingDetailPage({ user }) {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);

  const shareUrl = `${window.location.origin}/exchange/listing/${listingId}`;

  const load = useCallback(() => {
    api.get(`/exchange/listings/${listingId}`)
      .then(res => {
        const l = res.data;
        if (!['active', 'sold', 'in_auction'].includes(l.status)) {
          setNotFound(true);
        } else {
          setListing(l);
          document.title = `${l.title} — AirYatra Aviation Exchange`;
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [listingId]);

  useEffect(() => {
    load();
    return () => { document.title = 'AirYatra'; };
  }, [load]);

  const shareText = listing ? `${listing.title} — ${formatCr(listing.price_inr)} on AirYatra Aviation Exchange ✈️` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => toast.success('Link copied! Share it anywhere'));
  };

  const sendInquiry = async () => {
    if (!user) {
      toast.error('Please login to send an inquiry');
      return;
    }
    if (!inquiryMsg.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/exchange/listings/${listingId}/inquire`, { message: inquiryMsg });
      toast.success(res.data.message);
      setInquiryMsg('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send inquiry');
    } finally {
      setSending(false);
    }
  };

  const openInspection = () => {
    if (!user) {
      toast.error('Please login to book an inspection');
      return;
    }
    setInspectionOpen(true);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6" data-testid="listing-not-found">
        <Plane className="h-16 w-16 text-slate-700 mb-4" />
        <h1 className="text-2xl font-bold text-white">Listing Not Available</h1>
        <p className="text-slate-400 mt-2 text-center">This aircraft listing doesn't exist or is no longer public.</p>
        <Link to="/exchange">
          <Button className="mt-6 bg-orange-500 hover:bg-orange-600" data-testid="back-to-exchange-btn">
            <ArrowLeft className="h-4 w-4 mr-2" /> Browse Aviation Exchange
          </Button>
        </Link>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[listing.status];

  return (
    <div className="min-h-screen bg-slate-950" data-testid="public-listing-page">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/exchange" className="text-slate-400 hover:text-white flex items-center gap-1 text-sm" data-testid="back-exchange-link">
              <ArrowLeft className="h-4 w-4" /> Exchange
            </Link>
            <div className="flex items-center gap-2">
              <Plane className="h-6 w-6 text-orange-500" />
              <span className="text-xl font-bold text-white">Aviation <span className="text-orange-500">Exchange</span></span>
            </div>
          </div>
          <Button onClick={copyLink} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10" data-testid="header-share-btn">
            <Share2 className="h-4 w-4 mr-2" /> Share
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden">
          <img src={listing.image} alt={listing.title} className="w-full h-72 sm:h-96 object-cover" />
          {listing.verified && (
            <Badge className="absolute top-4 left-4 bg-green-500/90 text-white flex items-center gap-1">
              <BadgeCheck className="h-3 w-3" /> Verified by AirYatra
            </Badge>
          )}
          {statusBadge && <Badge className={`absolute top-4 right-4 font-bold ${statusBadge.cls}`} data-testid="listing-status-badge">{statusBadge.label}</Badge>}
          <div className="absolute bottom-4 right-4 bg-slate-950/85 backdrop-blur px-4 py-1.5 rounded-full text-orange-400 font-bold text-xl" data-testid="public-listing-price">
            {formatCr(listing.price_inr)}
          </div>
        </div>

        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white" data-testid="public-listing-title">{listing.title}</h1>
            <p className="text-slate-400 mt-1 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-orange-400" /> {listing.location} • Seller: {listing.seller_name}
            </p>
          </div>
          {/* Share buttons */}
          <div className="flex gap-2" data-testid="share-buttons">
            <Button onClick={copyLink} variant="outline" size="sm" className="border-slate-700 text-slate-300" data-testid="copy-link-btn">
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`} target="_blank" rel="noreferrer" data-testid="share-whatsapp-btn">
              <Button variant="outline" size="sm" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" data-testid="share-twitter-btn">
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                <Twitter className="h-4 w-4 mr-1" /> Post
              </Button>
            </a>
          </div>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            ['Year', listing.year, Clock],
            ['Flight Hours', listing.flight_hours?.toLocaleString(), Clock],
            ['Seats', listing.seats, Users],
            ['Views', listing.views || 0, Eye],
          ].map(([k, v, Icon]) => (
            <div key={k} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-center">
              <Icon className="h-4 w-4 text-orange-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{v}</p>
              <p className="text-slate-500 text-xs">{k}</p>
            </div>
          ))}
        </div>

        {listing.description && <p className="text-slate-300 mt-6 leading-relaxed">{listing.description}</p>}

        {(listing.features || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {listing.features.map(f => (
              <span key={f} className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-full text-xs text-slate-300">{f}</span>
            ))}
          </div>
        )}

        {/* CTAs */}
        {listing.status === 'active' && (
          <div className="mt-8 bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-bold text-lg mb-1">Interested in this aircraft?</h2>
            <p className="text-slate-400 text-sm mb-4">Send an inquiry or book a free pre-purchase inspection — DGCA documentation support included.</p>
            <textarea
              value={inquiryMsg}
              onChange={(e) => setInquiryMsg(e.target.value)}
              placeholder="I'm interested in this aircraft. Please share more details..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm min-h-[80px]"
              data-testid="public-inquiry-input"
            />
            <div className="flex gap-3 mt-3 flex-wrap">
              <Button onClick={sendInquiry} disabled={sending || !inquiryMsg.trim()} className="bg-orange-500 hover:bg-orange-600 flex-1 min-w-[180px]" data-testid="public-send-inquiry-btn">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {user ? 'Send Inquiry' : 'Login & Send Inquiry'}
              </Button>
              <Button onClick={openInspection} variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 flex-1 min-w-[180px]" data-testid="public-book-inspection-btn">
                <ClipboardCheck className="h-4 w-4 mr-2" /> Book Inspection
              </Button>
            </div>
          </div>
        )}

        {listing.status === 'in_auction' && (
          <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-center">
            <h2 className="text-white font-bold text-lg">This aircraft is in a LIVE auction! 🔨</h2>
            <Link to="/exchange?mode=auctions">
              <Button className="mt-3 bg-orange-500 hover:bg-orange-600" data-testid="goto-auction-btn">Go to Live Auction</Button>
            </Link>
          </div>
        )}

        <p className="text-slate-600 text-xs mt-8 text-center">
          AirYatra Aviation Exchange — India's First Aircraft Resale Marketplace • <Link to="/exchange" className="text-orange-400 hover:underline">Browse more aircraft</Link>
        </p>
      </div>

      <InspectionDialog listing={listing} open={inspectionOpen} onClose={() => setInspectionOpen(false)} />
    </div>
  );
}
