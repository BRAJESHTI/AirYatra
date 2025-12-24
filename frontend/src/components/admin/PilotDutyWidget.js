import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock, Shield, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reportsAPI, journeyAPI } from '@/services/api';
import { toast } from 'sonner';

function PilotDutyWidget() {
  const [pilotData, setPilotData] = useState({ pilots: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [showRestrictDialog, setShowRestrictDialog] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(null);
  const [restrictionData, setRestrictionData] = useState({
    restriction_reason: 'Duty hour limit exceeded',
    restriction_hours: 12
  });

  useEffect(() => {
    loadPilotData();
  }, []);

  const loadPilotData = async () => {
    try {
      const response = await reportsAPI.getPilotDutyHours({});
      setPilotData(response.data);
    } catch (error) {
      console.error('Failed to load pilot data');
    } finally {
      setLoading(false);
    }
  };

  const handleRestrictPilot = async () => {
    if (!selectedPilot) return;
    
    try {
      await journeyAPI.restrictPilot({
        pilot_id: selectedPilot.pilot_id,
        restricted: true,
        restriction_reason: restrictionData.restriction_reason,
        restriction_hours: restrictionData.restriction_hours
      });
      toast.success(`Pilot ${selectedPilot.pilot_name} restricted for ${restrictionData.restriction_hours} hours`);
      setShowRestrictDialog(false);
      setSelectedPilot(null);
      loadPilotData();
    } catch (error) {
      toast.error('Failed to restrict pilot');
    }
  };

  const handleUnrestrictPilot = async (pilot) => {
    try {
      await journeyAPI.restrictPilot({
        pilot_id: pilot.pilot_id,
        restricted: false
      });
      toast.success(`Pilot ${pilot.pilot_name} unrestricted`);
      loadPilotData();
    } catch (error) {
      toast.error('Failed to unrestrict pilot');
    }
  };

  const openRestrictDialog = (pilot) => {
    setSelectedPilot(pilot);
    setShowRestrictDialog(true);
  };

  const renderDutyBar = (hours, maxHours = 12) => {
    const percentage = Math.min((hours / maxHours) * 100, 100);
    let color = 'bg-green-500';
    if (hours > 12) color = 'bg-red-500';
    else if (hours >= 8) color = 'bg-orange-500';
    
    return (
      <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  if (loading) {
    return <div className="text-slate-400">Loading pilot data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Pilots</span>
          </div>
          <div className="text-2xl font-bold text-white mt-1">{pilotData.summary.total_pilots || 0}</div>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Red Flag (&gt;12h)</span>
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1">{pilotData.summary.red_flag_count || 0}</div>
        </div>
        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2 text-orange-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Orange Flag (8-12h)</span>
          </div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{pilotData.summary.orange_flag_count || 0}</div>
        </div>
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Green Flag (&lt;8h)</span>
          </div>
          <div className="text-2xl font-bold text-green-400 mt-1">{pilotData.summary.green_flag_count || 0}</div>
        </div>
      </div>

      {/* Duty Hours Graph */}
      <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Pilot Duty Hours (Last 24h)</h3>
        
        <div className="space-y-4">
          {pilotData.pilots.map((pilot, idx) => (
            <div key={idx} className={`p-4 rounded-lg ${
              pilot.duty_flag === 'red' ? 'bg-red-500/10 border border-red-500/30' :
              pilot.duty_flag === 'orange' ? 'bg-orange-500/10 border border-orange-500/30' :
              'bg-slate-800/50 border border-slate-700'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      pilot.duty_flag === 'red' ? 'bg-red-500 animate-pulse' :
                      pilot.duty_flag === 'orange' ? 'bg-orange-500' :
                      'bg-green-500'
                    }`} />
                    <span className="text-white font-medium">{pilot.pilot_name}</span>
                    <span className="text-slate-500 text-sm">({pilot.license_number})</span>
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {pilot.total_flights} flights • {pilot.total_flight_hours} total hours
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    pilot.duty_flag === 'red' ? 'text-red-400' :
                    pilot.duty_flag === 'orange' ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {pilot.last_24h_hours}h
                  </span>
                  {pilot.duty_flag === 'red' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRestrictDialog(pilot)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Ban className="h-4 w-4 mr-1" /> Restrict
                    </Button>
                  )}
                  {pilot.is_restricted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnrestrictPilot(pilot)}
                      className="border-green-500 text-green-400"
                    >
                      <Shield className="h-4 w-4 mr-1" /> Unrestrict
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Duty Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>0h</span>
                  <span>8h (Caution)</span>
                  <span>12h (Limit)</span>
                </div>
                {renderDutyBar(pilot.last_24h_hours)}
              </div>
              
              {/* Status Badge */}
              <div className="mt-2 flex justify-between items-center">
                <span className={`text-sm ${
                  pilot.duty_flag === 'red' ? 'text-red-400' :
                  pilot.duty_flag === 'orange' ? 'text-orange-400' :
                  'text-green-400'
                }`}>
                  {pilot.duty_status}
                </span>
                {pilot.is_restricted && (
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                    RESTRICTED
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {pilotData.pilots.length === 0 && (
            <div className="text-center py-8 text-slate-400">No pilots found</div>
          )}
        </div>
      </div>

      {/* Restrict Dialog */}
      <Dialog open={showRestrictDialog} onOpenChange={setShowRestrictDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Restrict Pilot
            </DialogTitle>
          </DialogHeader>
          
          {selectedPilot && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-white font-medium">{selectedPilot.pilot_name}</p>
                <p className="text-red-400 text-sm">
                  Current duty hours: {selectedPilot.last_24h_hours}h (exceeds 12h limit)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Restriction Reason</Label>
                <Input
                  value={restrictionData.restriction_reason}
                  onChange={(e) => setRestrictionData({ ...restrictionData, restriction_reason: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Rest Period (Hours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={restrictionData.restriction_hours}
                  onChange={(e) => setRestrictionData({ ...restrictionData, restriction_hours: parseInt(e.target.value) })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRestrictDialog(false)}>Cancel</Button>
            <Button onClick={handleRestrictPilot} className="bg-red-600 hover:bg-red-700">
              <Ban className="h-4 w-4 mr-2" /> Restrict Pilot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PilotDutyWidget;
