import React, { useState, useEffect, useCallback } from 'react';
import { Star, Gift, Ticket, TrendingUp, Zap, Crown, History, Clock, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

const TIER_COLORS = {
  bronze: 'from-amber-700 to-amber-900',
  silver: 'from-slate-400 to-slate-600',
  gold: 'from-yellow-400 to-amber-600',
  platinum: 'from-purple-400 to-purple-700',
};

const StatusHeader = ({ status }) => {
  if (!status) return null;
  const { profile, current_tier, next_tier, points_to_next_tier, progress_percent, earning } = status;
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 mb-6" data-testid="loyalty-status-card">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-slate-400 text-sm uppercase">Available Points</p>
          <p className="text-4xl font-black text-orange-400" data-testid="available-points">
            {(profile?.available_points || 0).toLocaleString()}
          </p>
          <p className="text-slate-500 text-xs mt-1">Lifetime: {(profile?.lifetime_points || 0).toLocaleString()} pts</p>
        </div>
        <div className="text-right">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${TIER_COLORS[current_tier?.id] || TIER_COLORS.bronze}`} data-testid="tier-badge">
            <Crown className="h-4 w-4 text-white" />
            <span className="text-white font-bold">{current_tier?.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1 text-green-400 text-sm" data-testid="earning-multiplier">
            <Zap className="h-4 w-4" />
            Earning at {earning?.effective_multiplier}x
            {earning?.membership_tier && earning?.membership_multiplier >= earning?.tier_multiplier && (
              <span className="text-amber-400 ml-1">({earning.membership_tier} member)</span>
            )}
          </div>
        </div>
      </div>
      {next_tier && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{current_tier?.name}</span>
            <span>{points_to_next_tier.toLocaleString()} pts to {next_tier.name}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all" style={{ width: `${progress_percent}%` }} />
          </div>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-3 text-xs">
        <span className="text-slate-400">{earning?.earn_rate} spent ×</span>
        {Object.entries(earning?.tier_multipliers || {}).map(([tier, mult]) => (
          <span key={tier} className={`px-2 py-0.5 rounded-full border ${current_tier?.id === tier ? 'border-orange-500 text-orange-400' : 'border-slate-600 text-slate-400'}`}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)} {mult}x
          </span>
        ))}
        <span className="text-amber-400">BLACK Members up to 3x 👑</span>
      </div>
    </div>
  );
};

const RewardCard = ({ reward, onRedeem }) => (
  <div className={`bg-slate-800/50 rounded-xl border p-5 flex flex-col ${reward.can_redeem ? 'border-orange-500/40 hover:border-orange-500' : 'border-slate-700'} transition-all`} data-testid={`reward-card-${reward.id}`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-3xl">{reward.icon}</span>
      {reward.tier_locked && (
        <Badge className="bg-slate-700 text-slate-300 text-xs">🔒 {reward.min_tier?.toUpperCase()}+</Badge>
      )}
    </div>
    <h4 className="text-white font-semibold">{reward.name}</h4>
    <p className="text-slate-400 text-xs mt-1 flex-1">{reward.description}</p>
    <div className="flex items-center justify-between mt-4">
      <span className="text-orange-400 font-bold flex items-center gap-1">
        <Star className="h-4 w-4 fill-orange-400" /> {reward.points_cost.toLocaleString()}
      </span>
      <Button
        size="sm"
        disabled={!reward.can_redeem}
        onClick={() => onRedeem(reward)}
        className={reward.can_redeem ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-700 text-slate-500'}
        data-testid={`redeem-btn-${reward.id}`}
      >
        Redeem
      </Button>
    </div>
  </div>
);

const VoucherRow = ({ voucher }) => {
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    navigator.clipboard.writeText(voucher.code);
    setCopied(true);
    toast.success('Voucher code copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  const statusColors = { active: 'bg-green-500/20 text-green-400', used: 'bg-slate-600/40 text-slate-400', expired: 'bg-red-500/20 text-red-400' };
  return (
    <div className="flex items-center justify-between bg-slate-800/50 rounded-lg border border-slate-700 p-4" data-testid={`voucher-${voucher.code}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{voucher.reward_icon || '🎁'}</span>
        <div>
          <p className="text-white text-sm font-medium">{voucher.reward_name}</p>
          <p className="text-slate-500 text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Expires {new Date(voucher.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={copyCode} className="flex items-center gap-1 px-3 py-1 bg-slate-900 rounded-lg border border-slate-600 text-orange-400 font-mono text-sm hover:border-orange-500" data-testid={`voucher-code-${voucher.code}`}>
          {voucher.code} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
        <Badge className={statusColors[voucher.status] || statusColors.active}>{voucher.status}</Badge>
      </div>
    </div>
  );
};

export default function LoyaltyRewards({ user }) {
  const [status, setStatus] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmReward, setConfirmReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [s, r, v, h] = await Promise.all([
        api.get('/loyalty/my-status'),
        api.get('/loyalty/rewards'),
        api.get('/loyalty/my-redemptions'),
        api.get('/loyalty/my-history'),
      ]);
      setStatus(s.data);
      setRewards(r.data.rewards || []);
      setVouchers(v.data.redemptions || []);
      setHistory(h.data.history || []);
    } catch (e) {
      toast.error('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRedeem = async () => {
    if (!confirmReward) return;
    setRedeeming(true);
    try {
      const res = await api.post(`/loyalty/rewards/${confirmReward.id}/redeem`);
      toast.success(`🎉 ${res.data.message} Code: ${res.data.voucher.code}`);
      setConfirmReward(null);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Redemption failed');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return <div className="text-center text-slate-400 py-20">Loading rewards...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto" data-testid="loyalty-rewards-page">
      <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
        <Star className="h-7 w-7 text-orange-500" /> VIP Points & Rewards</h1>
      <p className="text-slate-400 mb-6">Earn points on every flight. Redeem for vouchers & experiences.</p>

      <StatusHeader status={status} />

      {/* Rewards Catalog */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-orange-400" /> Rewards Catalog</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="rewards-catalog">
          {rewards.map(r => <RewardCard key={r.id} reward={r} onRedeem={setConfirmReward} />)}
        </div>
      </div>

      {/* My Vouchers */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-green-400" /> My Vouchers</h2>
        {vouchers.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800/30 rounded-lg p-4 border border-slate-700" data-testid="no-vouchers">No vouchers yet. Redeem a reward above!</p>
        ) : (
          <div className="space-y-3" data-testid="vouchers-list">
            {vouchers.map(v => <VoucherRow key={v.id} voucher={v} />)}
          </div>
        )}
      </div>

      {/* Points History */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-400" /> Points History</h2>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800/30 rounded-lg p-4 border border-slate-700" data-testid="no-history">
            No transactions yet. Complete a flight to earn points! ✈️
          </p>
        ) : (
          <div className="space-y-2" data-testid="points-history">
            {history.map((h, i) => (
              <div key={h.id || i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <TrendingUp className={`h-4 w-4 ${h.points > 0 ? 'text-green-400' : 'text-red-400 rotate-180'}`} />
                  <div>
                    <p className="text-slate-200 text-sm">{h.description}</p>
                    <p className="text-slate-500 text-xs">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`font-bold ${h.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {h.points > 0 ? '+' : ''}{h.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Confirmation Dialog */}
      <Dialog open={!!confirmReward} onOpenChange={(open) => !open && setConfirmReward(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white" data-testid="redeem-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{confirmReward?.icon}</span> Redeem {confirmReward?.name}?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will deduct <span className="text-orange-400 font-bold">{confirmReward?.points_cost?.toLocaleString()} points</span> from your balance.
              You will receive a voucher code valid for {confirmReward?.validity_days || 90} days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReward(null)} className="border-slate-600 text-slate-300" data-testid="cancel-redeem-btn">
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={redeeming} className="bg-orange-500 hover:bg-orange-600" data-testid="confirm-redeem-btn">
              {redeeming ? 'Redeeming...' : 'Confirm Redeem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
