import React, { useState, useEffect } from 'react';
import { Fuel, Plus, Trash2, MapPin, Calendar, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fleetAPI, fuelRecordAPI } from '../../services/api';
import { toast } from 'sonner';

function FuelRecordsManager({ operator }) {
  const [aircraft, setAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [fuelRecords, setFuelRecords] = useState([]);
  const [summary, setSummary] = useState({ total_refills: 0, total_fuel_liters: 0, total_cost: 0 });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    aircraft_id: '',
    location: '',
    fuel_amount_liters: '',
    fuel_type: 'Jet-A1',
    cost_per_liter: '',
    odometer_reading_km: '',
    remarks: '',
    refill_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAircraft();
  }, []);

  const fetchAircraft = async () => {
    try {
      const response = await fleetAPI.getAll();
      setAircraft(response.data.aircraft);
    } catch (error) {
      toast.error('Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };

  const fetchFuelRecords = async (aircraftId) => {
    try {
      const response = await fuelRecordAPI.getAircraftRecords(aircraftId);
      setFuelRecords(response.data.records);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load fuel records');
    }
  };

  const handleAircraftSelect = (aircraftId) => {
    const selected = aircraft.find(a => a.id === aircraftId);
    setSelectedAircraft(selected);
    setFormData({ ...formData, aircraft_id: aircraftId });
    fetchFuelRecords(aircraftId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fuelRecordAPI.create({
        ...formData,
        aircraft_id: selectedAircraft.id,
        fuel_amount_liters: parseFloat(formData.fuel_amount_liters),
        cost_per_liter: parseFloat(formData.cost_per_liter) || 0,
        odometer_reading_km: formData.odometer_reading_km ? parseFloat(formData.odometer_reading_km) : null,
      });

      toast.success('Fuel record added successfully');
      setIsAddDialogOpen(false);
      setFormData({
        aircraft_id: selectedAircraft?.id || '',
        location: '',
        fuel_amount_liters: '',
        fuel_type: 'Jet-A1',
        cost_per_liter: '',
        odometer_reading_km: '',
        remarks: '',
        refill_date: new Date().toISOString().split('T')[0]
      });
      fetchFuelRecords(selectedAircraft.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add fuel record');
    }
  };

  const handleDelete = async (fuelId) => {
    if (!window.confirm('Delete this fuel record?')) return;
    try {
      await fuelRecordAPI.delete(fuelId);
      toast.success('Fuel record deleted');
      fetchFuelRecords(selectedAircraft.id);
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-6xl mx-auto" data-testid="fuel-records">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Fuel Records</h1>
          <p className="text-slate-400">Track fuel refilling and consumption</p>
        </div>
        {selectedAircraft && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600" data-testid="add-fuel-btn">
                <Plus className="h-5 w-5 mr-2" />
                Add Refill
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Log Fuel Refill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Aircraft</Label>
                  <Input value={`${selectedAircraft?.aircraft_type} (${selectedAircraft?.registration_number})`} disabled className="bg-slate-800 border-slate-700" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="refill_date">Refill Date *</Label>
                    <Input
                      id="refill_date"
                      name="refill_date"
                      type="date"
                      value={formData.refill_date}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Refill Location *</Label>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Mumbai Helipad"
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fuel_amount_liters">Fuel Amount (Liters) *</Label>
                    <Input
                      id="fuel_amount_liters"
                      name="fuel_amount_liters"
                      type="number"
                      step="0.1"
                      value={formData.fuel_amount_liters}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel_type">Fuel Type</Label>
                    <select
                      id="fuel_type"
                      name="fuel_type"
                      value={formData.fuel_type}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-md bg-slate-800 border-slate-700 text-white"
                    >
                      <option value="Jet-A1">Jet-A1</option>
                      <option value="Jet-A">Jet-A</option>
                      <option value="AvGas">AvGas 100LL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_liter">Cost per Liter (₹)</Label>
                    <Input
                      id="cost_per_liter"
                      name="cost_per_liter"
                      type="number"
                      step="0.01"
                      value={formData.cost_per_liter}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="odometer_reading_km">Odometer (KM)</Label>
                    <Input
                      id="odometer_reading_km"
                      name="odometer_reading_km"
                      type="number"
                      value={formData.odometer_reading_km}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows="2"
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                  Save Fuel Record
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Aircraft Selector */}
      <div className="mb-6">
        <Label className="text-white mb-2 block">Select Aircraft</Label>
        <select
          value={selectedAircraft?.id || ''}
          onChange={(e) => handleAircraftSelect(e.target.value)}
          className="w-full max-w-md h-10 px-3 rounded-md bg-slate-800 border-slate-700 text-white"
        >
          <option value="">Choose an aircraft...</option>
          {aircraft.map(a => (
            <option key={a.id} value={a.id}>
              {a.aircraft_type} - {a.registration_number}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {selectedAircraft && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Total Refills</p>
            <p className="text-2xl font-bold text-white">{summary.total_refills}</p>
          </div>
          <div className="glass p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Total Fuel (L)</p>
            <p className="text-2xl font-bold text-cyan-400">{summary.total_fuel_liters.toLocaleString()}</p>
          </div>
          <div className="glass p-4 rounded-lg">
            <p className="text-slate-400 text-sm">Total Cost</p>
            <p className="text-2xl font-bold text-green-400">₹{summary.total_cost.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Fuel Records List */}
      {selectedAircraft && (
        <div className="glass p-6 rounded-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Refill History - {selectedAircraft.aircraft_type}</h2>
          {fuelRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Fuel className="h-12 w-12 mx-auto mb-2 text-slate-600" />
              <p>No fuel records yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fuelRecords.map((record) => (
                <div key={record.id} className="bg-slate-800 p-4 rounded-lg flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Fuel className="h-5 w-5 text-cyan-400" />
                      <span className="text-white font-semibold">{record.fuel_amount_liters}L</span>
                      <span className="text-slate-400">({record.fuel_type})</span>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center"><MapPin className="h-4 w-4 mr-1" />{record.location}</span>
                      <span className="flex items-center"><Calendar className="h-4 w-4 mr-1" />{new Date(record.refill_date).toLocaleDateString()}</span>
                      {record.total_cost > 0 && (
                        <span className="flex items-center text-green-400"><IndianRupee className="h-4 w-4 mr-1" />₹{record.total_cost.toLocaleString()}</span>
                      )}
                    </div>
                    {record.remarks && <p className="text-sm text-slate-300 mt-2 italic">{record.remarks}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(record.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FuelRecordsManager;
