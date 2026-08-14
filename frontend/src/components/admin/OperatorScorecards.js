import React, { useState, useEffect } from 'react';
import { Trophy, Loader2, Star, Timer, Target, Medal } from 'lucide-react';
import api from '@/services/api';

const gradeColor = {
  'A+': 'bg-green-500/20 text-green-400',
  'A': 'bg-emerald-500/20 text-emerald-300',
  'B': 'bg-yellow-500/20 text-yellow-400',
  'C': 'bg-orange-500/20 text-orange-400',
  '—': 'bg-slate-600/40 text-slate-400',
};

const medalColor = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function OperatorScorecards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/pricing/operator-scorecards')
      .then((res) => setCards(res.data.scorecards || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;

  return (
    <div className="max-w-5xl" data-testid="operator-scorecards">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-400" /> Operator Scorecards
        </h2>
        <p className="text-slate-400 text-sm">
          Operators ki ranking — quotes won (45%), ratings (30%) aur on-time flights (25%) ke composite score par.
        </p>
      </div>

      <div className="space-y-3" data-testid="scorecards-list">
        {cards.map((c) => (
          <div key={c.operator_id}
            className={`glass rounded-xl p-4 flex items-center gap-4 flex-wrap ${c.rank <= 3 ? 'border border-orange-500/30' : ''}`}
            data-testid={`scorecard-${c.operator_id}`}>
            <div className="flex items-center gap-3 min-w-[220px]">
              <div className="w-10 text-center">
                {c.rank <= 3 ? (
                  <Medal className={`h-7 w-7 mx-auto ${medalColor[c.rank - 1]}`} />
                ) : (
                  <span className="text-slate-500 font-bold">#{c.rank}</span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold">{c.company_name}</p>
                <p className="text-slate-500 text-xs uppercase">{c.status || 'active'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-wrap flex-1">
              <div className="text-center">
                <p className="text-slate-400 text-[10px] uppercase flex items-center gap-1"><Target className="h-3 w-3" /> Quotes Won</p>
                <p className="text-white font-bold">{c.quotes_won}<span className="text-slate-500 font-normal">/{c.quotes_sent}</span>
                  <span className="text-orange-400 text-xs ml-1">({c.win_rate}%)</span></p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-[10px] uppercase flex items-center gap-1"><Star className="h-3 w-3" /> Rating</p>
                <p className="text-white font-bold">{c.rating ? `${c.rating} ★` : 'N/A'}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-[10px] uppercase flex items-center gap-1"><Timer className="h-3 w-3" /> On-Time</p>
                <p className="text-white font-bold">{c.on_time_percent !== null && c.on_time_percent !== undefined ? `${c.on_time_percent}%` : 'N/A'}
                  <span className="text-slate-500 text-xs font-normal ml-1">({c.flights_total} flights)</span></p>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-[160px] justify-end">
              <div className="w-24">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-400" style={{ width: `${c.score}%` }} />
                </div>
                <p className="text-white text-sm font-bold text-right mt-0.5" data-testid={`score-${c.operator_id}`}>{c.score}</p>
              </div>
              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${gradeColor[c.grade] || gradeColor['—']}`} data-testid={`grade-${c.operator_id}`}>
                {c.grade}
              </span>
            </div>
          </div>
        ))}
        {cards.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No operator data available.</p>}
      </div>
    </div>
  );
}
