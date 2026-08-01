import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plane, Search, MapPin, Clock, Users, BadgeCheck, ArrowLeft, Send, Loader2, TrendingUp, PlusCircle, Star, PieChart, ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../services/api';
import SellAircraftForm from '../components/exchange/SellAircraftForm';
import FractionalSection from '../components/exchange/FractionalSection';

const CATEGORIES = [
  { id: 'all', label: 'All Aircraft' },
  { id: 'helicopter', label: '🚁 Helicopters' },
  { id: 'jet', label: '✈️ Private Jets' },
  { id: 'turboprop', label: '🛩️ Turboprops' },
];

const formatCr = (price) => `₹${(price / 10000000).toFixed(price % 10000000 === 0 ? 0 : 1)} Cr`;

const ListingCard = ({ listing, onView }) => (
  <div
    className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden hover:border-orange-500/50 hover:-translate-y-1 transition-all cursor-pointer group"
    onClick={() => onView(listing)}
    data-testid={`listing-card-${listing.id}`}
  >
    <div className="relative h-48 overflow-hidden">
      <img src={listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      {listing.verified && (
        <Badge className="absolute top-3 left-3 bg-green-500/90 text-white flex items-center gap-1">
          <BadgeCheck className="h-3 w-3" /> Verified
        </Badge>
      )}
      <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-full text-orange-400 font-bold" data-testid={`listing-price-${listing.id}`}>
        {formatCr(listing.price_inr)}
      </div>
    </div>
    <div className="p-5">
      <h3 className="text-white font-bold text-lg">{listing.title}</h3>
      <p className="text-slate-500 text-xs mb-3">{listing.year} • {listing.seller_name}</p>
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-orange-400" /> {listing.flight_hours.toLocaleString()} hrs</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3 text-orange-400" /> {listing.seats} seats</span>
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-orange-400" /> {listing.location.split(',')[0]}</span>
      </div>
    </div>
  </div>
);

const FeaturedStrip = ({ featured, onView }) => (
  <div className="max-w-7xl mx-auto px-6 pb-8" data-testid="featured-strip">
    <div className="flex items-center gap-2 mb-3">
      <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
      <h2 className="text-lg font-bold text-white">Featured Aircraft / विशेष विमान</h2>
    </div>
    <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
      {featured.map(l => (
        <div
          key={l.id}
          onClick={() => onView(l)}
          className="min-w-[300px] snap-start cursor-pointer rounded-2xl p-[1.5px] bg-gradient-to-br from-amber-400/70 via-orange-500/40 to-amber-400/70 hover:-translate-y-1 transition-transform"
          data-testid={`featured-card-${l.id}`}
        >
          <div className="bg-slate-900 rounded-2xl overflow-hidden h-full">
            <div className="relative h-36 overflow-hidden">
              <img src={l.image} alt={l.title} className="w-full h-full object-cover" />
              <Badge className="absolute top-2 left-2 bg-amber-400 text-slate-900 font-bold">
                <Star className="h-3 w-3 mr-1 fill-slate-900" /> FEATURED
              </Badge>
              <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur px-2.5 py-0.5 rounded-full text-amber-400 font-bold text-sm">
                {formatCr(l.price_inr)}
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-white font-bold">{l.title}</h3>
              <p className="text-slate-500 text-xs mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-400" /> {l.flight_hours?.toLocaleString()} hrs</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-amber-400" /> {l.location?.split(',')[0]}</span>
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function AviationExchangePage({ user }) {
  const [listings, setListings] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('buy');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const openSell = () => {
    if (!user) {
      toast.error('Please login to sell your aircraft / विमान बेचने के लिए लॉगिन करें');
      return;
    }
    setSellOpen(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category, sort });
      if (search) params.set('search', search);
      const res = await api.get(`/exchange/listings?${params}`);
      setListings(res.data.listings || []);
    } catch (e) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [category, sort, search]);

  useEffect(() => { load(); }, [category, sort]); // eslint-disable-line

  useEffect(() => {
    api.get('/exchange/featured').then(res => setFeatured(res.data.listings || [])).catch(() => {});
  }, []);

  const sendInquiry = async () => {
    if (!user) {
      toast.error('Please login to send an inquiry / पूछताछ के लिए लॉगिन करें');
      return;
    }
    if (!inquiryMsg.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/exchange/listings/${selected.id}/inquire`, { message: inquiryMsg });
      toast.success(res.data.message);
      setInquiryMsg('');
      setSelected(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send inquiry');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="aviation-exchange-page">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white flex items-center gap-1 text-sm" data-testid="back-home-link">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="flex items-center gap-2">
              <Plane className="h-6 w-6 text-orange-500" />
              <span className="text-xl font-bold text-white">Aviation <span className="text-orange-500">Exchange</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30 hidden sm:flex">
              <TrendingUp className="h-3 w-3 mr-1" /> India's First Aircraft Resale Marketplace
            </Badge>
            <Button onClick={openSell} className="bg-orange-500 hover:bg-orange-600" data-testid="sell-aircraft-btn">
              <PlusCircle className="h-4 w-4 mr-2" /> Sell Aircraft
            </Button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <h1 className="text-4xl sm:text-5xl font-black text-white">
          Buy & Sell Aircraft,<br /><span className="text-orange-500">The Smart Way</span>
        </h1>
        <p className="text-slate-400 mt-3 max-w-2xl">
          Pre-owned helicopters, private jets and turboprops — verified sellers, transparent pricing, DGCA documentation support. / सत्यापित विक्रेता, पारदर्शी कीमतें।
        </p>
        <Button onClick={openSell} variant="outline" className="mt-4 border-orange-500/50 text-orange-400 hover:bg-orange-500/10" data-testid="sell-aircraft-hero-btn">
          <PlusCircle className="h-4 w-4 mr-2" /> List Your Aircraft for Free / अपना विमान लिस्ट करें
        </Button>
      </div>

      {/* Mode Toggle */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="inline-flex bg-slate-900 border border-slate-800 rounded-full p-1" data-testid="mode-toggle">
          <button
            onClick={() => setMode('buy')}
            className={`px-5 py-2 rounded-full text-sm flex items-center gap-2 transition-all ${mode === 'buy' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            data-testid="mode-buy-btn"
          >
            <ShoppingBag className="h-4 w-4" /> Buy Aircraft
          </button>
          <button
            onClick={() => setMode('fractional')}
            className={`px-5 py-2 rounded-full text-sm flex items-center gap-2 transition-all ${mode === 'fractional' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            data-testid="mode-fractional-btn"
          >
            <PieChart className="h-4 w-4" /> Fractional Ownership
          </button>
        </div>
      </div>

      {mode === 'fractional' ? (
        <div className="max-w-7xl mx-auto px-6 pb-16">
          <FractionalSection user={user} />
        </div>
      ) : (
        <>
          {/* Featured Spotlight */}
          {featured.length > 0 && <FeaturedStrip featured={featured} onView={setSelected} />}

          {/* Filters */}
          <div className="max-w-7xl mx-auto px-6 pb-6 flex flex-wrap items-center gap-3">
            <div className="flex gap-2 flex-wrap" data-testid="category-filters">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-4 py-2 rounded-full text-sm border transition-all ${category === c.id ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-700 text-slate-300 hover:border-orange-500/50'}`}
                  data-testid={`category-${c.id}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                  placeholder="Search model, city..."
                  className="pl-9 w-52 bg-slate-900 border-slate-700 text-white"
                  data-testid="search-input"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-md px-3 text-sm"
                data-testid="sort-select"
              >
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low → High</option>
                <option value="price_high">Price: High → Low</option>
                <option value="hours_low">Lowest Hours</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          <div className="max-w-7xl mx-auto px-6 pb-16">
            {loading ? (
              <div className="text-center text-slate-500 py-20">Loading listings...</div>
            ) : listings.length === 0 ? (
              <div className="text-center text-slate-500 py-20" data-testid="no-listings">No aircraft found for these filters.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="listings-grid">
                {listings.map(l => <ListingCard key={l.id} listing={l} onView={setSelected} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="listing-detail-dialog">
          {selected && (
            <>
              <img src={selected.image} alt={selected.title} className="w-full h-56 object-cover rounded-xl" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  {selected.title}
                  {selected.verified && <BadgeCheck className="h-5 w-5 text-green-400" />}
                </DialogTitle>
                <DialogDescription className="text-orange-400 text-xl font-bold">
                  {formatCr(selected.price_inr)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[['Year', selected.year], ['Hours', selected.flight_hours.toLocaleString()], ['Seats', selected.seats], ['Views', (selected.views || 0) + 1]].map(([k, v]) => (
                  <div key={k} className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-500 text-xs">{k}</p>
                    <p className="text-white font-bold">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-slate-300 text-sm">{selected.description}</p>
              <div className="flex flex-wrap gap-2">
                {(selected.features || []).map(f => (
                  <span key={f} className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">{f}</span>
                ))}
              </div>
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {selected.location} • Seller: {selected.seller_name}
              </p>
              <div className="border-t border-slate-700 pt-4">
                <p className="text-white font-medium mb-2">Interested? Send an inquiry / पूछताछ भेजें</p>
                <textarea
                  value={inquiryMsg}
                  onChange={(e) => setInquiryMsg(e.target.value)}
                  placeholder="I'm interested in this aircraft. Please share more details..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm min-h-[80px]"
                  data-testid="inquiry-message-input"
                />
                <Button
                  onClick={sendInquiry}
                  disabled={sending || !inquiryMsg.trim()}
                  className="w-full mt-2 bg-orange-500 hover:bg-orange-600"
                  data-testid="send-inquiry-btn"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {user ? 'Send Inquiry' : 'Login & Send Inquiry'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SellAircraftForm open={sellOpen} onClose={() => setSellOpen(false)} user={user} />
    </div>
  );
}
