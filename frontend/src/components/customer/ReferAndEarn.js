import React, { useState, useEffect } from 'react';
import { 
  Gift, Share2, Copy, Check, Wallet, TrendingUp, Users, 
  ChevronRight, Loader2, ExternalLink, MessageCircle, Mail,
  IndianRupee, History, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { referralAPI } from '../../services/api';
import { toast } from 'sonner';

function ReferAndEarn({ user }) {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('refer');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, walletRes] = await Promise.all([
        referralAPI.getMyCode(),
        referralAPI.getReferralStats(),
        referralAPI.getWallet()
      ]);
      
      setReferralCode(codeRes.data);
      setStats(statsRes.data);
      setWallet(walletRes.data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = referralCode ? 
    `${window.location.origin}/booking?ref=${referralCode.code}` : '';

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard! / क्लिपबोर्ड पर कॉपी हो गया!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const shareViaWhatsApp = () => {
    const message = `🚁 AirYatra पर हेलीकॉप्टर बुक करें और पहली बुकिंग पर 10% छूट पाएं! मेरा रेफरल कोड: ${referralCode?.code}\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'AirYatra - Helicopter Booking Discount';
    const body = `Hi!\n\nBook a helicopter on AirYatra and get 10% off on your first booking!\n\nUse my referral code: ${referralCode?.code}\n\nBook now: ${referralLink}\n\nHappy flying! 🚁`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <Gift className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Refer & Earn / रेफर करें और कमाएं</h2>
        <p className="text-slate-400 mt-1">Share with friends and earn rewards on their bookings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setActiveTab('refer')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'refer' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Share2 className="h-4 w-4" /> Refer / रेफर करें
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'wallet' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Wallet className="h-4 w-4" /> Wallet / वॉलेट
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'history' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <History className="h-4 w-4" /> History / इतिहास
        </button>
      </div>

      {/* Refer Tab */}
      {activeTab === 'refer' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
              <Users className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats?.total_referrals || 0}</p>
              <p className="text-slate-400 text-xs">Total Referrals</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
              <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-400">{stats?.successful_referrals || 0}</p>
              <p className="text-slate-400 text-xs">Successful</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
              <IndianRupee className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-400">₹{stats?.total_earnings || 0}</p>
              <p className="text-slate-400 text-xs">Total Earned</p>
            </div>
          </div>

          {/* Referral Code Box */}
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-6 border border-purple-500/30">
            <p className="text-slate-300 text-sm mb-2">Your Referral Code / आपका रेफरल कोड</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-900/50 rounded-lg px-4 py-3 font-mono text-2xl text-white tracking-wider">
                {referralCode?.code || 'Loading...'}
              </div>
              <Button
                onClick={() => copyToClipboard(referralCode?.code)}
                className="bg-purple-500 hover:bg-purple-600"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Share Link */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 text-sm mb-2">Share Link / लिंक शेयर करें</p>
            <div className="flex items-center gap-2">
              <Input
                value={referralLink}
                readOnly
                className="bg-slate-900 border-slate-600 text-white text-sm"
              />
              <Button
                onClick={() => copyToClipboard(referralLink)}
                variant="outline"
                className="border-slate-600"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Share Buttons */}
            <div className="flex gap-3 mt-4">
              <Button
                onClick={shareViaWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={shareViaEmail}
                variant="outline"
                className="flex-1 border-slate-600"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          {/* How it Works */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">How it Works / कैसे काम करता है</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">1</div>
                <div>
                  <p className="text-white">Share your code / अपना कोड शेयर करें</p>
                  <p className="text-slate-400 text-sm">Share your referral link with friends and family</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">2</div>
                <div>
                  <p className="text-white">They book a flight / वो उड़ान बुक करें</p>
                  <p className="text-slate-400 text-sm">They get 10% off on their first booking</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">3</div>
                <div>
                  <p className="text-white">You earn rewards / आप कमाएं</p>
                  <p className="text-slate-400 text-sm">₹500 added to your wallet for each successful booking</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          {/* Wallet Balance */}
          <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-xl p-6 border border-green-500/30 text-center">
            <Wallet className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-slate-300 text-sm">Wallet Balance / वॉलेट बैलेंस</p>
            <p className="text-4xl font-bold text-white mt-2">₹{wallet?.balance?.toLocaleString() || 0}</p>
            <p className="text-green-400 text-sm mt-2">Use this while booking / बुकिंग में उपयोग करें</p>
          </div>

          {/* Wallet Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
              <p className="text-slate-400 text-sm">Total Earned</p>
              <p className="text-xl font-bold text-green-400">₹{wallet?.total_earned?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <IndianRupee className="h-5 w-5 text-orange-400 mb-2" />
              <p className="text-slate-400 text-sm">Total Used</p>
              <p className="text-xl font-bold text-orange-400">₹{wallet?.total_used?.toLocaleString() || 0}</p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Recent Transactions / हाल के लेन-देन</h3>
            {wallet?.transactions?.length > 0 ? (
              <div className="space-y-3">
                {wallet.transactions.slice(0, 5).map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === 'credit' || tx.type === 'referral_bonus' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.type === 'credit' || tx.type === 'referral_bonus' ? '+' : '-'}
                      </div>
                      <div>
                        <p className="text-white text-sm">{tx.reason}</p>
                        <p className="text-slate-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${
                      tx.type === 'credit' || tx.type === 'referral_bonus' 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {tx.type === 'credit' || tx.type === 'referral_bonus' ? '+' : '-'}₹{tx.amount}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-6">No transactions yet / अभी कोई लेन-देन नहीं</p>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Referral History / रेफरल इतिहास</h3>
          {stats?.recent_referrals?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_referrals.map((ref, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      ref.status === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                    }`}>
                      <Users className={`h-5 w-5 ${
                        ref.status === 'completed' ? 'text-green-400' : 'text-yellow-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white">Booking ₹{ref.booking_amount?.toLocaleString()}</p>
                      <p className="text-slate-500 text-xs">{new Date(ref.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">+₹{ref.bonus_amount}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      ref.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {ref.status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No referrals yet / अभी कोई रेफरल नहीं</p>
              <p className="text-slate-500 text-sm">Share your code to start earning!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReferAndEarn;
