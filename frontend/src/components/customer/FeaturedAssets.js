import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Ship, Plane, IndianRupee, Sparkles, Flame } from 'lucide-react';
import api from '../../services/api';

const ICONS = { helipad: Plane, yacht: Anchor, cruise: Ship, helicopter: Plane, jet: Plane };
const GRAD = {
  helicopter: 'from-orange-600/70 to-slate-900', jet: 'from-purple-600/70 to-slate-900',
  yacht: 'from-cyan-600/70 to-slate-900', cruise: 'from-indigo-600/70 to-slate-900',
  helipad: 'from-sky-600/70 to-slate-900',
};

export default function FeaturedAssets() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const scrollRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    api.get('/verticals/featured').then(r => setItems(r.data.featured || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const timer = setInterval(() => {
      if (pausedRef.current || el.scrollWidth <= el.clientWidth) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 240, behavior: 'smooth' });
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [items]);

  if (items.length === 0) return null;

  const go = (item) => {
    if (['yacht', 'cruise', 'helipad'].includes(item.type)) navigate(`/customer/book`);
    else navigate('/booking');
  };

  return (
    <div className="mb-8" data-testid="featured-assets-row">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-orange-400" /> Featured — Helicopters, Jets, Yachts & Cruises
      </h2>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}>
        {items.map((item) => {
          const Icon = ICONS[item.type] || Plane;
          const isDeal = item.deal_of_the_day;
          return (
            <button key={`${item.type}-${item.id}`} onClick={() => go(item)}
              className={`flex-shrink-0 w-56 rounded-xl overflow-hidden border text-left transition-colors ${
                isDeal
                  ? 'border-orange-500 bg-slate-900 ring-2 ring-orange-500/40 shadow-lg shadow-orange-900/30'
                  : 'border-slate-700/60 bg-slate-900/60 hover:border-orange-500/60'
              }`}
              data-testid={isDeal ? 'deal-of-the-day-card' : `featured-${item.type}-${item.id}`}>
              <div className="h-28 relative">
                {item.cover ? (
                  <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${GRAD[item.type] || GRAD.helicopter} flex items-center justify-center`}>
                    <Icon className="h-10 w-10 text-white/70" />
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">{item.type}</span>
                {isDeal && (
                  <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse" data-testid="deal-of-the-day-badge">
                    <Flame className="h-3 w-3" /> DEAL OF THE DAY
                  </span>
                )}
                {!isDeal && item.photo_count > 0 && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">📷 {item.photo_count}</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                <p className="text-slate-500 text-xs truncate">{item.city}</p>
                {isDeal ? (
                  <p className="text-orange-400 text-sm font-bold flex items-center gap-1 mt-1">
                    <IndianRupee className="h-3 w-3" />{Number(item.deal_price).toLocaleString('en-IN')}
                    <span className="text-slate-500 text-[11px] font-normal line-through flex items-center">
                      ₹{Number(item.price).toLocaleString('en-IN')}
                    </span>
                    <span className="text-slate-500 text-[10px] font-normal">/ {item.unit}</span>
                  </p>
                ) : (
                  <p className="text-orange-400 text-sm font-bold flex items-center gap-0.5 mt-1">
                    <IndianRupee className="h-3 w-3" />{Number(item.price).toLocaleString('en-IN')}
                    <span className="text-slate-500 text-[10px] font-normal ml-1">/ {item.unit}</span>
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
