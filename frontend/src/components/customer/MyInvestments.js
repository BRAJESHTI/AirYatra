import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Download, Loader2, Clock, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '../../services/api';

const formatCr = (p) => `₹${(p / 10000000).toFixed(p % 10000000 === 0 ? 0 : 1)} Cr`;

const STATUS_STYLES = {
  new: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  contacted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const STATUS_LABELS = {
  new: 'Under Review / समीक्षा में',
  contacted: 'In Discussion / चर्चा में',
  approved: 'Allocated ✅ / आवंटित',
  rejected: 'Not Allocated / अस्वीकृत',
};

export const MyInvestments = ({ user }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/exchange/fractional/my-reservations')
      .then(res => setReservations(res.data.reservations || []))
      .catch(() => toast.error('Failed to load investments'))
      .finally(() => setLoading(false));
  }, []);

  const downloadCertificate = async (r) => {
    setDownloading(r.id);
    try {
      const res = await api.get(`/exchange/fractional/certificate/${r.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `AirYatra_Share_Certificate_${r.id.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Certificate downloaded! / प्रमाणपत्र डाउनलोड हो गया');
    } catch (e) {
      toast.error('Failed to download certificate');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const approvedValue = reservations.filter(r => r.status === 'approved').reduce((s, r) => s + r.share_price_inr * r.shares, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="my-investments">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PieChart className="h-6 w-6 text-orange-500" /> My Investments / मेरा निवेश
        </h1>
        <p className="text-slate-400 text-sm">Your fractional aircraft ownership portfolio</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Reservations', reservations.length],
          ['Approved Shares', reservations.filter(r => r.status === 'approved').reduce((s, r) => s + r.shares, 0)],
          ['Portfolio Value', approvedValue > 0 ? formatCr(approvedValue) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4" data-testid={`investment-stat-${label.toLowerCase().replace(' ', '-')}`}>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {reservations.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl" data-testid="no-investments">
          <Gem className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">You don't have any fractional investments yet.</p>
          <p className="text-slate-500 text-sm mt-1">Own an aircraft at 1/8th the cost — with guaranteed flying hours every year.</p>
          <Button onClick={() => navigate('/exchange')} className="mt-4 bg-orange-500 hover:bg-orange-600" data-testid="explore-fractional-btn">
            <PieChart className="h-4 w-4 mr-2" /> Explore Fractional Ownership
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map(r => (
            <div key={r.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4" data-testid={`investment-${r.id}`}>
              {r.aircraft_image && <img src={r.aircraft_image} alt={r.title} className="w-full sm:w-32 h-20 object-cover rounded-lg" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold">{r.title}</h3>
                  <Badge className={`border ${STATUS_STYLES[r.status] || ''}`} data-testid={`investment-status-${r.id}`}>{STATUS_LABELS[r.status] || r.status}</Badge>
                </div>
                <p className="text-orange-400 font-bold text-sm mt-1">
                  {r.shares} × 1/{r.total_shares || 8} share{r.shares > 1 ? 's' : ''} • {formatCr(r.share_price_inr * r.shares)}
                </p>
                <p className="text-slate-400 text-xs mt-1 flex items-center gap-3 flex-wrap">
                  {r.hours_per_share && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.hours_per_share * r.shares} flying hrs/year</span>}
                  <span>Reserved {new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                </p>
              </div>
              {r.status === 'approved' && (
                <Button
                  onClick={() => downloadCertificate(r)}
                  disabled={downloading === r.id}
                  className="bg-green-600 hover:bg-green-700 shrink-0 self-center"
                  data-testid={`download-certificate-${r.id}`}
                >
                  {downloading === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Certificate
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyInvestments;
