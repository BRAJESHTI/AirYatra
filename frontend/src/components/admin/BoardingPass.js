import React, { useState, useEffect } from 'react';
import { Ticket, Download, QrCode, Plane, RefreshCw, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function BoardingPass() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPass, setSelectedPass] = useState(null);

  useEffect(() => { loadPasses(); }, []);

  const loadPasses = async () => {
    try {
      const res = await api.get('/boarding-pass/my-passes');
      setPasses(res.data.boarding_passes || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const downloadPass = async (passId) => {
    try {
      const res = await api.get(`/boarding-pass/${passId}/download`);
      // Handle download
      alert('Boarding pass downloaded!');
    } catch (error) { alert('Failed to download'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Ticket className="h-6 w-6 mr-2 text-green-500" /> Digital Boarding Passes
          </h1>
          <p className="text-slate-400">Mobile-friendly boarding passes with QR codes</p>
        </div>
        <Button onClick={loadPasses} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {passes.length > 0 ? (
        <div className="grid grid-cols-2 gap-6">
          {passes.map(pass => (
            <div key={pass.id} className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl p-6 border border-orange-500/30">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-orange-400 text-sm font-medium">BOARDING PASS</p>
                  <p className="text-white text-2xl font-bold">{pass.booking_number}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <QrCode className="h-16 w-16 text-slate-900" />
                </div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <p className="text-white text-2xl font-bold">{pass.origin}</p>
                  <p className="text-slate-400 text-sm">Origin</p>
                </div>
                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="h-px bg-slate-600 flex-1" />
                  <Plane className="h-6 w-6 text-orange-400 mx-2" />
                  <div className="h-px bg-slate-600 flex-1" />
                </div>
                <div className="text-center">
                  <p className="text-white text-2xl font-bold">{pass.destination}</p>
                  <p className="text-slate-400 text-sm">Destination</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-slate-400 text-xs">DATE</p>
                  <p className="text-white font-medium">{pass.date}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">TIME</p>
                  <p className="text-white font-medium">{pass.time}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">SEAT</p>
                  <p className="text-white font-medium">{pass.seat || 'A1'}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => downloadPass(pass.id)} className="flex-1 bg-orange-500">
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <Ticket className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl text-white mb-2">No Boarding Passes</h3>
          <p className="text-slate-400">Your digital boarding passes will appear here after booking</p>
        </div>
      )}
    </div>
  );
}

export default BoardingPass;
