import React, { useState, useEffect } from 'react';
import { Plane, Plus, MapPin, Clock, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fleetAPI, flightRecordAPI, operatorAPI } from '../../services/api';
import { toast } from 'sonner';

function FlightRecordsManager({ operator }) {
  const [aircraft, setAircraft] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [flightRecords, setFlightRecords] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    aircraft_id: '',
    pilot_id: '',
    departure_location: '',
    arrival_location: '',
    departure_time: '',
    arrival_time: '',
    distance_km: '',
    fuel_used_liters: '',
    average_speed_kmh: '',
    max_altitude_feet: '',
    weather_conditions: '',
    remarks: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [aircraftRes, pilotsRes] = await Promise.all([
        fleetAPI.getAll(),
        operatorAPI.getPilots()
      ]);
      setAircraft(aircraftRes.data.aircraft);
      setPilots(pilotsRes.data.pilots);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlightRecords = async (aircraftId) => {
    try {
      const response = await flightRecordAPI.getAircraftRecords(aircraftId);
      setFlightRecords(response.data.records);
    } catch (error) {
      toast.error('Failed to load flight records');
    }
  };

  const handleAircraftSelect = (aircraftId) => {
    const selected = aircraft.find(a => a.id === aircraftId);
    setSelectedAircraft(selected);
    fetchFlightRecords(aircraftId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const flightDuration = formData.arrival_time && formData.departure_time
        ? Math.round((new Date(formData.arrival_time) - new Date(formData.departure_time)) / 60000)
        : null;

      await flightRecordAPI.create({
        ...formData,
        distance_km: parseFloat(formData.distance_km),
        fuel_used_liters: parseFloat(formData.fuel_used_liters) || 0,
        average_speed_kmh: parseFloat(formData.average_speed_kmh) || null,
        max_altitude_feet: parseFloat(formData.max_altitude_feet) || null,
        flight_duration_minutes: flightDuration
      });

      toast.success('Flight record added successfully');
      setIsAddDialogOpen(false);
      setFormData({
        aircraft_id: selectedAircraft?.id || '',
        pilot_id: '',
        departure_location: '',
        arrival_location: '',
        departure_time: '',
        arrival_time: '',
        distance_km: '',
        fuel_used_liters: '',
        average_speed_kmh: '',
        max_altitude_feet: '',
        weather_conditions: '',
        remarks: ''
      });

      if (selectedAircraft) {
        fetchFlightRecords(selectedAircraft.id);
        fetchData(); // Refresh aircraft to get updated KM
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add flight record');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-6xl mx-auto" data-testid="flight-records">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Flight Records</h1>
          <p className="text-slate-400">Track all flights and maintain logbook</p>
        </div>
        {selectedAircraft && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600" data-testid="add-flight-btn">
                <Plus className="h-5 w-5 mr-2" />
                Log Flight
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Log Flight Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aircraft</Label>
                    <Input value={selectedAircraft?.aircraft_type} disabled className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pilot_id">Pilot *</Label>
                    <select
                      id="pilot_id"
                      name="pilot_id"
                      value={formData.pilot_id}
                      onChange={handleChange}
                      required
                      className="w-full h-10 px-3 rounded-md bg-slate-800 border-slate-700 text-white"
                    >
                      <option value="">Select Pilot</option>
                      {pilots.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure_location">Departure Location *</Label>
                    <Input
                      id="departure_location"
                      name="departure_location"
                      value={formData.departure_location}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival_location">Arrival Location *</Label>
                    <Input
                      id="arrival_location"
                      name="arrival_location"
                      value={formData.arrival_location}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure_time">Departure Time *</Label>
                    <Input
                      id="departure_time"
                      name="departure_time"
                      type="datetime-local"
                      value={formData.departure_time}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival_time">Arrival Time</Label>
                    <Input
                      id="arrival_time"
                      name="arrival_time"
                      type="datetime-local"
                      value={formData.arrival_time}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance_km">Distance (KM) *</Label>
                    <Input
                      id="distance_km"
                      name="distance_km"
                      type="number"
                      step="0.1"
                      value={formData.distance_km}
                      onChange={handleChange}
                      required
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel_used_liters">Fuel Used (L)</Label>
                    <Input
                      id="fuel_used_liters"
                      name="fuel_used_liters"
                      type="number"
                      step="0.1"
                      value={formData.fuel_used_liters}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="average_speed_kmh">Avg Speed (km/h)</Label>
                    <Input
                      id="average_speed_kmh"
                      name="average_speed_kmh"
                      type="number"
                      value={formData.average_speed_kmh}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_altitude_feet">Max Altitude (feet)</Label>
                    <Input
                      id="max_altitude_feet"
                      name="max_altitude_feet"
                      type="number"
                      value={formData.max_altitude_feet}
                      onChange={handleChange}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weather_conditions">Weather</Label>
                    <Input
                      id="weather_conditions"
                      name="weather_conditions"
                      value={formData.weather_conditions}
                      onChange={handleChange}
                      placeholder="Clear, Cloudy, Rain, etc."
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
                    rows="3"
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                  Save Flight Record
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

      {/* Flight Records List */}
      {selectedAircraft && (
        <div className="glass p-6 rounded-lg">
          <h2 className="text-2xl font-bold text-white mb-4">
            Flight History - {selectedAircraft.aircraft_type}
          </h2>
          {flightRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Plane className="h-12 w-12 mx-auto mb-2 text-slate-600" />
              <p>No flight records yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flightRecords.map((record) => (
                <div key={record.id} className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-3 text-white font-semibold">
                        <MapPin className="h-5 w-5 text-orange-500" />
                        <span>{record.departure_location} → {record.arrival_location}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Pilot: {record.pilot_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{record.distance_km} KM</div>
                      {record.flight_duration_minutes && (
                        <div className="text-sm text-slate-400">{Math.floor(record.flight_duration_minutes / 60)}h {record.flight_duration_minutes % 60}m</div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Departure:</span>
                      <div className="text-white">{new Date(record.departure_time).toLocaleString()}</div>
                    </div>
                    {record.arrival_time && (
                      <div>
                        <span className="text-slate-400">Arrival:</span>
                        <div className="text-white">{new Date(record.arrival_time).toLocaleString()}</div>
                      </div>
                    )}
                    {record.fuel_used_liters > 0 && (
                      <div>
                        <span className="text-slate-400">Fuel:</span>
                        <div className="text-white">{record.fuel_used_liters}L</div>
                      </div>
                    )}
                    {record.average_speed_kmh && (
                      <div>
                        <span className="text-slate-400">Avg Speed:</span>
                        <div className="text-white">{record.average_speed_kmh} km/h</div>
                      </div>
                    )}
                  </div>
                  {record.remarks && (
                    <div className="mt-3 text-sm text-slate-300 italic">
                      {record.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FlightRecordsManager;