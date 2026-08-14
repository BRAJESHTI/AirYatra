import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Ship, Plane, IndianRupee, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    api.get('/verticals/featured').then(r => setItems(r.data.featured || [])).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  const go = (item) => {
    if (['yacht', 'cruise', 'helipad'].includes(item.type)) navigate(`/customer/marine?v=${item.type}`);
    else navigate('/booking');
  };

  return (
    <div className="mb-8" data-testid="featured-assets-row">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-orange-400" /> Featured — Helicopters, Jets, Yachts & Cruises
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => {
          const Icon = ICONS[item.type] || Plane;
          return (
            <button key={`${item.type}-${item.id}`} onClick={() => go(item)}
              className="flex-shrink-0 w-56 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900/60 text-left hover:border-orange-500/60 transition-colors"
              data-testid={`featured-${item.type}-${item.id}`}>
              <div className="h-28 relative">
                {item.cover ? (
                  <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${GRAD[item.type] || GRAD.helicopter} flex items-center justify-center`}>
                    <Icon className="h-10 w-10 text-white/70" />
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">{item.type}</span>
                {item.photo_count > 0 && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">📷 {item.photo_count}</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                <p className="text-slate-500 text-xs truncate">{item.city}</p>
                <p className="text-orange-400 text-sm font-bold flex items-center gap-0.5 mt-1">
                  <IndianRupee className="h-3 w-3" />{Number(item.price).toLocaleString('en-IN')}
                  <span className="text-slate-500 text-[10px] font-normal ml-1">/ {item.unit}</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
